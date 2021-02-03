import html
import json
import re
from collections import defaultdict

import sqlalchemy
from flask import Blueprint, current_app, jsonify, g
from flask_apispec import use_kwargs
from sqlalchemy.orm import aliased

from neo4japp.blueprints.auth import auth
from neo4japp.constants import FILE_INDEX_ID, FRAGMENT_SIZE
from neo4japp.data_transfer_objects import GeneFilteredRequest
from neo4japp.data_transfer_objects.common import ResultList, ResultQuery
from neo4japp.database import get_search_service_dao, db, get_elastic_service
from neo4japp.models import (
    Projects,
    AppRole,
    projects_collaborator_role, AppUser, Directory, Project, Files
)
from neo4japp.request_schemas.search import (
    AnnotateRequestSchema,
    AdvancedContentSearchSchema,
    OrganismSearchSchema,
    VizSearchSchema
)
from neo4japp.services.annotations.constants import AnnotationMethod
from neo4japp.services.annotations.pipeline import create_annotations
from neo4japp.util import jsonify_with_class, SuccessResponse
from neo4japp.utils.logger import UserEventLog

bp = Blueprint('search', __name__, url_prefix='/search')


@bp.route('/viz-search', methods=['POST'])
@auth.login_required
@use_kwargs(VizSearchSchema)
def visualizer_search(
    query,
    page,
    limit,
    domains,
    entities,
    organism
):
    search_dao = get_search_service_dao()
    current_app.logger.info(
        f'Term: {query}, Organism: {organism}, Entities: {entities}, Domains: {domains}',
        extra=UserEventLog(
            username=g.current_user.username, event_type='search temp').to_dict()
    )

    results = search_dao.visualizer_search(
        term=query,
        organism=organism,
        page=page,
        limit=limit,
        domains=domains,
        entities=entities,
    )
    return jsonify({
        'result': results.to_dict(),
    })


@bp.route('/annotate', methods=['POST'])
@auth.login_required
@use_kwargs(AnnotateRequestSchema)
def annotate(texts):
    # If done right, we would parse the XML but the built-in XML libraries in Python
    # are susceptible to some security vulns, but because this is an internal API,
    # we can accept that it can be janky
    container_tag_re = re.compile("^<snippet>(.*)</snippet>$", re.DOTALL | re.IGNORECASE)
    highlight_strip_tag_re = re.compile("^<highlight>([^<]+)</highlight>$", re.IGNORECASE)
    highlight_add_tag_re = re.compile("^%%%%%-(.+)-%%%%%$", re.IGNORECASE)

    results = []

    for text in texts:
        annotations = []

        # Remove the outer document tag
        text = container_tag_re.sub("\\1", text)
        # Remove the highlight tags to help the annotation parser
        text = highlight_strip_tag_re.sub("%%%%%-\\1-%%%%%", text)

        try:
            annotations = create_annotations(
                annotation_method=AnnotationMethod.RULES.value,
                document=text,
                filename='snippet.pdf',
                specified_organism_synonym='',
                specified_organism_tax_id='',
            )['documents'][0]['passages'][0]['annotations']
        except Exception as e:
            pass

        for annotation in annotations:
            keyword = annotation['keyword']
            text = re.sub(
                # Replace but outside tags (shh @ regex)
                f"({re.escape(keyword)})(?![^<]*>|[^<>]*</)",
                f'<annotation type="{annotation["meta"]["type"]}" '
                f'meta="{html.escape(json.dumps(annotation["meta"]))}"'
                f'>\\1</annotation>',
                text,
                flags=re.IGNORECASE)

        # Re-add the highlight tags
        text = highlight_add_tag_re.sub("<highlight>\\1</highlight>", text)
        # Re-wrap with document tags
        text = f"<snippet>{text}</snippet>"

        results.append(text)

    return jsonify({
        'texts': results,
    })


def hydrate_search_results(es_results):
    es_mapping = defaultdict(lambda: {})

    for doc in es_results['hits']:
        es_mapping[doc['_source']['type']][doc['_source']['id']] = doc

    t_owner = aliased(AppUser)
    t_directory = aliased(Directory)
    t_project = aliased(Projects)

    map_query = db.session.query(Project.hash_id.label('id'),
                                 Project.label.label('name'),
                                 Project.description.label('description'),
                                 sqlalchemy.literal_column('NULL').label('annotation_date'),
                                 Project.creation_date.label('creation_date'),
                                 Project.modified_date.label('modification_date'),
                                 t_owner.id.label('owner_id'),
                                 t_owner.username.label('owner_username'),
                                 t_owner.first_name.label('owner_first_name'),
                                 t_owner.last_name.label('owner_last_name'),
                                 t_project.project_name.label('project_name'),
                                 sqlalchemy.literal_column('\'map\'').label('type')) \
        .join(t_owner, t_owner.id == Project.user_id) \
        .join(t_directory, t_directory.id == Project.dir_id) \
        .join(t_project, t_project.id == t_directory.projects_id) \
        .filter(Project.hash_id.in_(es_mapping['map'].keys()))

    file_query = db.session.query(Files.file_id.label('id'),
                                  Files.filename.label('name'),
                                  Files.description.label('description'),
                                  Files.annotations_date.label('annotation_date'),
                                  Files.creation_date.label('creation_date'),
                                  Files.modified_date.label('modification_date'),
                                  t_owner.id.label('owner_id'),
                                  t_owner.username.label('owner_username'),
                                  t_owner.first_name.label('owner_first_name'),
                                  t_owner.last_name.label('owner_last_name'),
                                  t_project.project_name.label('project_name'),
                                  sqlalchemy.literal_column('\'pdf\'').label('type')) \
        .join(t_owner, t_owner.id == Files.user_id) \
        .join(t_directory, t_directory.id == Files.dir_id) \
        .join(t_project, t_project.id == t_directory.projects_id) \
        .filter(Files.file_id.in_(es_mapping['pdf'].keys()))

    combined_query = sqlalchemy.union_all(map_query, file_query).alias('combined_results')
    query = db.session.query(combined_query)

    for row in query.all():
        row = row._asdict()
        doc = es_mapping[row['type']][row['id']]
        doc['_db'] = row


# Start Search Helpers #

def empty_params(q, advanced_args):
    q_exists = q != ''
    types_exists = advanced_args.get('types', None) is not None and advanced_args['types'] != ''
    projects_exists = (
        advanced_args.get('projects', None) is not None and
        advanced_args['projects'] != ''
    )
    return not (q_exists or types_exists or projects_exists)


def get_types_from_params(advanced_args):
    types = set()
    if 'types' in advanced_args and advanced_args['types'] != '':
        types = set(advanced_args['types'].split(';'))

    # If we found any types in the advanced args, use them. Otherwise default is all.
    return list(types) if len(types) > 0 else ['map', 'pdf']


def get_projects_from_params(advanced_args):
    projects = set()
    if 'projects' in advanced_args and advanced_args['projects'] != '':
        projects = set(advanced_args['projects'].split(';'))

    return list(projects)


def get_accessible_projects_filter(user_id):
    t_project = aliased(Projects)
    t_project_role = aliased(AppRole)

    # Role table used to check if we have permission
    query = db.session.query(
        t_project.id
    ).join(
        projects_collaborator_role,
        sqlalchemy.and_(
            projects_collaborator_role.c.projects_id == t_project.id,
            projects_collaborator_role.c.appuser_id == user_id,
        )
    ).join(
        t_project_role,
        sqlalchemy.and_(
            t_project_role.id == projects_collaborator_role.c.app_role_id,
            sqlalchemy.or_(
                t_project_role.name == 'project-read',
                t_project_role.name == 'project-write',
                t_project_role.name == 'project-admin'
            )
        )
    )
    accessible_project_ids = [project_id for project_id, in query]

    return {
        'bool': {
            'should': [
                # If the user has access to the project the document is in...
                {'terms': {'project_id': accessible_project_ids}},
                # OR if the document is public...
                {'term': {'public': True}}
            ]
        }
    }


def prep_search_results(search_results, search_phrases):
    highlight_tag_re = re.compile('@@@@(/?)\\$')

    results = []
    for doc in search_results['hits']:
        snippets = None

        db_data = doc.get('_db', defaultdict(lambda: None))

        if doc.get('highlight', None) is not None:
            if doc['highlight'].get('data.content', None) is not None:
                snippets = doc['highlight']['data.content']

        if snippets:
            for i, snippet in enumerate(snippets):
                snippet = html.escape(snippet)
                snippet = highlight_tag_re.sub('<\\1highlight>', snippet)
                snippets[i] = f"<snippet>{snippet}</snippet>"

        results.append({
            'item': {
                # TODO LL-1723: Need to add complete file path here
                'type': 'file' if doc['_source']['type'] == 'pdf' else 'map',
                'id': doc['_source']['id'],
                'name': db_data['name'] or doc['_source']['filename'],
                'description': db_data['description'] or doc['_source']['description'],
                'highlight': snippets,
                'doi': doc['_source']['doi'],
                'creation_date': db_data['creation_date'] or doc['_source']['uploaded_date'],
                'modification_date': db_data['modification_date'],
                'annotation_date': db_data['annotation_date'],
                'project': {
                    'project_name': db_data['project_name'] or doc['_source']['project_name'],
                },
                'creator': {
                    'username': db_data['owner_username'] or doc['_source']['username'],
                },
            },
            'rank': doc['_score'],
        })

    return ResultList(
        total=search_results['total'],
        results=results,
        query=ResultQuery(phrases=search_phrases),
    )

# End Search Helpers #


@bp.route('/content', methods=['GET'])
@auth.login_required
@use_kwargs(AdvancedContentSearchSchema)
def search(
    limit,
    page,
    q,
    **advanced_args
):
    current_app.logger.info(
        f'Term: {q}',
        extra=UserEventLog(
            username=g.current_user.username, event_type='search contentsearch').to_dict()
    )

    if empty_params(q, advanced_args):
        return jsonify(
            ResultList(
                total=0,
                results=[],
                query=ResultQuery(phrases=[])
            ).to_dict(),
        )

    offset = (page - 1) * limit

    types = get_types_from_params(advanced_args)
    projects = get_projects_from_params(advanced_args)

    # Set the search term once we've parsed 'q' for all advanced options
    search_term = q

    # Set additional elastic search query options
    text_fields = ['description', 'data.content', 'filename']
    text_field_boosts = {'description': 1, 'data.content': 1, 'filename': 3}
    keyword_fields = []
    keyword_field_boosts = {}
    highlight = {
        'fields': {
            'data.content': {},
        },
        # Need to be very careful with this option. If fragment_size is too large, search
        # will be slow because elastic has to generate large highlight fragments. Setting
        # to 0 generates cleaner sentences, but also runs the risk of pulling back huge
        # sentences.
        'fragment_size': FRAGMENT_SIZE,
        'order': 'score',
        'pre_tags': ['@@@@$'],
        'post_tags': ['@@@@/$'],
        'number_of_fragments': 100,
    }

    query_filter = {
        'bool': {
            'must': [
                # The document must have the specified type...
                {'terms': {'type': types}},
                # ...And the user must have access to the document...
                get_accessible_projects_filter(g.current_user.id),
                # ...And the project name should match at least one of the given project strings...
                {
                    'bool': {
                        'should': [{
                            'multi_match': {
                                    'query': project,  # type:ignore
                                    'type': 'phrase',  # type:ignore
                                    'fields': ['project_name']
                            }
                        } for project in projects],
                    }
                }
            ]
        }
    }

    elastic_service = get_elastic_service()
    res, search_phrases = elastic_service.search(
        index_id=FILE_INDEX_ID,
        search_term=search_term,
        offset=offset,
        limit=limit,
        text_fields=text_fields,
        text_field_boosts=text_field_boosts,
        keyword_fields=keyword_fields,
        keyword_field_boosts=keyword_field_boosts,
        query_filter=query_filter,
        highlight=highlight
    )
    res = res['hits']
    hydrate_search_results(res)

    response = prep_search_results(res, search_phrases)
    return jsonify(response.to_dict())


@bp.route('/organism/<string:organism_tax_id>', methods=['GET'])
@auth.login_required
@jsonify_with_class()
def get_organism(organism_tax_id: str):
    search_dao = get_search_service_dao()
    result = search_dao.get_organism_with_tax_id(organism_tax_id)
    return SuccessResponse(result=result, status_code=200)


@bp.route('/organisms', methods=['POST'])
@auth.login_required
@use_kwargs(OrganismSearchSchema)
def get_organisms(query, limit):
    search_dao = get_search_service_dao()
    results = search_dao.get_organisms(query, limit)
    return jsonify({'result': results})
