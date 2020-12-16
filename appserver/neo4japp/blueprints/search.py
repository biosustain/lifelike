import html
import json
import re
from collections import defaultdict

import sqlalchemy
from flask import Blueprint, current_app, jsonify, g
from flask_apispec import use_kwargs
from sqlalchemy.orm import aliased

from neo4japp.blueprints.auth import auth
from neo4japp.constants import FILE_INDEX_ID
from neo4japp.data_transfer_objects import GeneFilteredRequest
from neo4japp.data_transfer_objects.common import ResultList, ResultQuery
from neo4japp.database import get_search_service_dao, db, get_elastic_service
from neo4japp.models import (
    Projects,
    AppRole,
    projects_collaborator_role, AppUser, Files
)
from neo4japp.request_schemas.search import (
    AnnotateRequestSchema,
    ContentSearchSchema,
    OrganismSearchSchema,
    VizSearchSchema
)
from neo4japp.services.annotations.constants import AnnotationMethod
from neo4japp.services.annotations.pipeline import create_annotations
from neo4japp.util import jsonify_with_class, SuccessResponse
from neo4japp.utils.logger import UserEventLog

bp = Blueprint('search', __name__, url_prefix='/search')


# NOTE: Commenting out as these are unused...do we need these?

# @bp.route('/search', methods=['POST'])
# @auth.login_required
# @jsonify_with_class(SearchRequest)
# def fulltext_search(req: SearchRequest):
#     search_dao = get_search_service_dao()
#     results = search_dao.fulltext_search(req.query, req.page, req.limit)
#     return SuccessResponse(result=results, status_code=200)


# @bp.route('/simple-search', methods=['POST'])
# @auth.login_required
# @jsonify_with_class(SimpleSearchRequest)
# def simple_full_text_search(req: SimpleSearchRequest):
#     search_dao = get_search_service_dao()
#     results = search_dao.simple_text_search(req.query, req.page, req.limit, req.filter)
#     return SuccessResponse(result=results, status_code=200)


# TODO: Added as part of LL-1067, this is a TEMP solution until we design a
# search service consistent with both the visualizer and the drawing tool.
# This will need tests if we decide to maintain it as a standalone service.
@bp.route('/viz-search-temp', methods=['POST'])
@auth.login_required
@use_kwargs(VizSearchSchema)
def visualizer_search_temp(query, page, limit, filter, organism):
    search_dao = get_search_service_dao()
    current_app.logger.info(
        f'Term: {query}, Organism: {organism}, Filter: {filter}',
        extra=UserEventLog(
            username=g.current_user.username, event_type='search temp').to_dict()
    )
    results = search_dao.visualizer_search_temp(
        term=query,
        organism=organism,
        page=page,
        limit=limit,
        filter=filter
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
    pass
    # TODO


# TODO: Probably should rename this to something else...not sure what though
@bp.route('/content', methods=['GET'])
@auth.login_required
@use_kwargs(ContentSearchSchema)
def search(q, types, limit, page):
    current_app.logger.info(
        f'Term: {q}',
        extra=UserEventLog(
            username=g.current_user.username, event_type='search contentsearch').to_dict()
    )
    search_term = q
    types = types.split(';')
    offset = (page - 1) * limit
    search_phrases = []

    if search_term:
        text_fields = ['description', 'data.content', 'filename']
        text_field_boosts = {'description': 1, 'data.content': 1, 'filename': 3}
        keyword_fields = []
        keyword_field_boosts = {}
        highlight = {
            'fields': {
                'data.content': {},
            },
            # Need to be very careful with this option. If fragment_size is too large, search
            # will be slow because elastic has to generate large highlight fragments. Setting to
            # default for now.
            # 'fragment_size': FRAGMENT_SIZE,
            'fragment_size': 0,
            'order': 'score',
            'pre_tags': ['@@@@$'],
            'post_tags': ['@@@@/$'],
            'number_of_fragments': 200,
        }

        user_id = g.current_user.id

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
        query_filter = {
            'bool': {
                'must': [
                    # The document must have the specified type
                    {'terms': {'type': types}},
                    # And...
                    {
                        'bool': {
                            'should': [
                                # If the user has access to the project the document is in...
                                {'terms': {'project_id': accessible_project_ids}},
                                # OR if the document is public...
                                {'term': {'public': True}}
                            ]
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
    else:
        res = {'hits': [], 'max_score': None, 'total': 0}

    highlight_tag_re = re.compile('@@@@(/?)\\$')

    results = []
    for doc in res['hits']:
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

    response = ResultList(
        total=res['total'],
        results=results,
        query=ResultQuery(phrases=search_phrases),
    )

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


@bp.route('/genes_filtered_by_organism_and_others', methods=['POST'])
@auth.login_required
@jsonify_with_class(GeneFilteredRequest)
def get_genes_filtering_by_organism(req: GeneFilteredRequest):
    search_dao = get_search_service_dao()
    results = search_dao.search_genes_filtering_by_organism_and_others(
        req.query, req.organism_id, req.filters)
    return SuccessResponse(result=results, status_code=200)
