import html
import json
import re
from collections import defaultdict
from typing import Optional

import sqlalchemy
from flask import Blueprint, current_app, jsonify, g
from flask_apispec import use_kwargs
from sqlalchemy.orm import aliased
from webargs.flaskparser import use_args

from neo4japp.blueprints.auth import auth
from neo4japp.blueprints.filesystem import FilesystemBaseView
from neo4japp.constants import FILE_INDEX_ID
from neo4japp.data_transfer_objects.common import ResultList, ResultQuery
from neo4japp.database import get_search_service_dao, db, get_elastic_service
from neo4japp.models import (
    Projects,
    AppRole,
    projects_collaborator_role, Files
)
from neo4japp.schemas.common import PaginatedRequestSchema
from neo4japp.schemas.search import (
    AnnotateRequestSchema,
    ContentSearchSchema,
    OrganismSearchSchema,
    VizSearchSchema, ContentSearchResponseSchema
)
from neo4japp.services.annotations.constants import AnnotationMethod
from neo4japp.services.annotations.pipeline import create_annotations
from neo4japp.util import jsonify_with_class, SuccessResponse
from neo4japp.utils.logger import UserEventLog
from neo4japp.utils.request import Pagination

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


class ContentSearchView(FilesystemBaseView):
    decorators = [auth.login_required]

    @use_args(ContentSearchSchema)
    @use_args(PaginatedRequestSchema)
    def post(self, params: dict, pagination: Pagination):
        current_user = g.current_user

        search_term = params['q']
        mime_types = params['mime_types']

        current_app.logger.info(
            f'Term: {search_term}',
            extra=UserEventLog(
                username=g.current_user.username, event_type='search contentsearch').to_dict()
        )

        offset = (pagination.page - 1) * pagination.limit
        search_phrases = []

        text_fields = ['description', 'data.content', 'filename']
        text_field_boosts = {'description': 1, 'data.content': 1, 'filename': 3}
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
                    {'terms': {'mime_type': mime_types}},
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
        elastic_result, search_phrases = elastic_service.search(
            index_id=FILE_INDEX_ID,
            search_term=search_term,
            offset=offset,
            limit=pagination.limit,
            text_fields=text_fields,
            text_field_boosts=text_field_boosts,
            keyword_fields=[],
            keyword_field_boosts={},
            query_filter=query_filter,
            highlight=highlight
        )

        elastic_result = elastic_result['hits']

        highlight_tag_re = re.compile('@@@@(/?)\\$')

        # Load the files for this result page from the database
        file_ids = [doc['_source']['id'] for doc in elastic_result['hits']]
        file_map = {file.id: file for file in
                    self.get_nondeleted_recycled_files(Files.id.in_(file_ids))}

        results = []
        for document in elastic_result['hits']:
            file_id = document['_source']['id']
            file: Optional[Files] = file_map.get(file_id)

            if file and file.calculated_privileges[current_user.id].readable:
                if file.mime_type != 'vnd.***ARANGO_DB_NAME***.document/map' and \
                        document.get('highlight') is not None:
                    if document['highlight'].get('data.content') is not None:
                        snippets = document['highlight']['data.content']
                        for i, snippet in enumerate(snippets):
                            snippet = html.escape(snippet)
                            snippet = highlight_tag_re.sub('<\\1highlight>', snippet)
                            snippets[i] = f"<snippet>{snippet}</snippet>"
                        file.calculated_highlight = snippets

                results.append({
                    'item': file,
                    'rank': document['_score'],
                })

        return jsonify(ContentSearchResponseSchema(context={
            'user_privilege_filter': g.current_user.id,
        }).dump({
            'total': elastic_result['total'],
            'query': ResultQuery(phrases=search_phrases),
            'results': results,
        }))


bp.add_url_rule('content', view_func=ContentSearchView.as_view('content_search'))


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
