import html
import json
import re
from typing import List, Optional


import sqlalchemy
from flask import Blueprint, current_app, jsonify, g
from flask_apispec import use_kwargs
from sqlalchemy.orm import aliased
from webargs.flaskparser import use_args

from neo4japp.blueprints.auth import auth
from neo4japp.constants import FILE_INDEX_ID, FRAGMENT_SIZE, LogEventType
from neo4japp.blueprints.filesystem import FilesystemBaseView
from neo4japp.data_transfer_objects import GeneFilteredRequest
from neo4japp.data_transfer_objects.common import ResultList, ResultQuery
from neo4japp.database import (
    db,
    get_search_service_dao,
    get_elastic_service,
    get_file_type_service
)
from neo4japp.models import (
    Projects,
    AppRole,
    projects_collaborator_role, Files
)
from neo4japp.schemas.common import PaginatedRequestSchema
from neo4japp.schemas.search import (
    ContentSearchSchema,
    OrganismSearchSchema,
    VizSearchSchema,
    ContentSearchResponseSchema
)
from neo4japp.services.file_types.providers import (
    EnrichmentTableTypeProvider,
    MapTypeProvider,
    HTMLTypeProvider,
    PDFTypeProvider
)
from neo4japp.util import jsonify_with_class, SuccessResponse

from neo4japp.utils.logger import EventLog, UserEventLog
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
            username=g.current_user.username,
            event_type=LogEventType.VISUALIZER_SEARCH.value).to_dict()
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


# Start Search Helpers #

def empty_params(params):
    return not any([params[key] for key in params.keys()])


def get_types_from_params(q, advanced_args, file_type_service):
    # Get document types from either `q` or `types`
    types = []
    if 'types' in advanced_args and advanced_args['types'] != '':
        types = advanced_args['types'].split(';')

    # Even if `types` is in the advanced args, expect `q` might also contain some types
    extracted_types = re.findall(r'\btype:\S*', q)

    if len(extracted_types) > 0:
        q = re.sub(r'\btype:\S*', '', q)
        for extracted_type in extracted_types:
            types.append(extracted_type.split(':')[1])

    mime_types = []
    shorthand_to_mime_type_map = file_type_service.get_shorthand_to_mime_type_map()
    for t in types:
        if t in shorthand_to_mime_type_map:
            mime_types.append(shorthand_to_mime_type_map[t])

    # If we found any types in the advanced args, or in the query, use them. Otherwise default is
    # all.
    if len(mime_types) > 0:
        return q, mime_types
    else:
        # If we ever add new *searchable* types to the content search, they should be added here.
        # We may eventually just use a loop over all providers in the file_type_service, but right
        # now it doesn't really make sense to include directory in the content search.
        return q, [
            EnrichmentTableTypeProvider.MIME_TYPE,
            MapTypeProvider.MIME_TYPE,
            PDFTypeProvider.MIME_TYPE
        ]


def get_projects_from_params(q, advanced_args):
    # Get projects from either `q` or `projects`
    projects = []
    if 'projects' in advanced_args and advanced_args['projects'] != '':
        projects = advanced_args['projects'].split(';')

    # Even if `projects` is in the advanced args, expect `q` might also contain some projects
    extracted_projects = re.findall(r'\bproject:\S*', q)

    if len(extracted_projects) > 0:
        q = re.sub(r'\bproject:\S*', '', q)
        for extracted_type in extracted_projects:
            projects.append(extracted_type.split(':')[1])

    return q, projects


def get_wildcards_from_params(q, advanced_args):
    # Get wildcards from `wildcards`
    wildcards = []
    if 'wildcards' in advanced_args and advanced_args['wildcards'] != '':
        wildcards = advanced_args['wildcards'].split(';')

    return ' '.join([q] + wildcards)


def get_phrase_from_params(q, advanced_args):
    if 'phrase' in advanced_args and advanced_args['phrase'] != '':
        q += ' "' + advanced_args['phrase'] + '"'

    return q


def get_projects_filter(user_id: int, projects: List[str]):
    query = Projects.user_has_permission_to_projects(user_id, projects)

    if len(projects) > 0:
        # TODO: Right now filtering by project name works because project names are unique.
        # It's likely that in the future this will no longer be the case! When that happens,
        # We can uniquely identify a project using both the username of the project owner,
        # AND the project name. E.g., johndoe/project-name is unique.

        # We can further extend this behavior to directories. A directory can be uniquely
        # identified by its path, with the owner's username as the root.
        query = query.filter(
            Projects.name.in_(projects)
        )
        accessible_and_filtered_project_ids = [project_id for project_id, in query]
        return {
            'bool': {
                'must': [
                    # If the document is in the filtered list of projects...
                    {'terms': {'project_id': accessible_and_filtered_project_ids}},
                ]
            }
        }
    else:
        accessible_project_ids = [project_id for project_id, in query]
        return {
            'bool': {
                'should': [
                    # If the user has access to the project the document is in...
                    {'terms': {'project_id': accessible_project_ids}},
                    # OR if the document is public.
                    {'term': {'public': True}}
                ]
            }
        }

# End Search Helpers #


class ContentSearchView(FilesystemBaseView):
    decorators = [auth.login_required]

    @use_args(ContentSearchSchema)
    @use_args(PaginatedRequestSchema)
    def post(self, params: dict, pagination: Pagination):
        current_app.logger.info(
            f'Term: {params["q"]}',
            extra=UserEventLog(
                username=g.current_user.username,
                event_type=LogEventType.CONTENT_SEARCH.value).to_dict()
        )

        current_user = g.current_user
        file_type_service = get_file_type_service()

        if empty_params(params):
            return jsonify(ContentSearchResponseSchema(context={
                'user_privilege_filter': g.current_user.id,
            }).dump({
                'total': 0,
                'query': ResultQuery(phrases=[]),
                'results': [],
            }))

        offset = (pagination.page - 1) * pagination.limit

        q = params['q']
        q, types = get_types_from_params(q, params, file_type_service)
        q, projects = get_projects_from_params(q, params)
        q = get_wildcards_from_params(q, params)
        q = get_phrase_from_params(q, params)

        # Set the search term once we've parsed 'q' for all advanced options
        search_term = q.strip()

        text_fields = ['description', 'data.content', 'filename']
        text_field_boosts = {'description': 1, 'data.content': 1, 'filename': 3}
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
                    {'terms': {'mime_type': types}},
                    # ...And must be accessible by the user, and in the specified list of
                    # projects or public if no list is given...
                    get_projects_filter(g.current_user.id, projects),
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

        # So while we have the results from Elasticsearch, they don't contain up to date or
        # complete data about the matched files, so we'll take the hash IDs returned by Elastic
        # and query our database
        file_ids = [doc['_source']['id'] for doc in elastic_result['hits']]
        file_map = {file.id: file for file in
                    self.get_nondeleted_recycled_files(Files.id.in_(file_ids))}

        results = []
        for document in elastic_result['hits']:
            file_id = document['_source']['id']
            file: Optional[Files] = file_map.get(file_id)

            if file and file.calculated_privileges[current_user.id].readable:
                file_type = file_type_service.get(file)
                if file_type.should_highlight_content_text_matches() and \
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
