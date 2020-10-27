import attr
import sqlalchemy
from flask import Blueprint, request, jsonify, g, current_app
from flask_apispec import use_kwargs
from sqlalchemy.orm import aliased

from neo4japp.blueprints.auth import auth
from neo4japp.constants import FILE_INDEX_ID, FRAGMENT_SIZE
from neo4japp.database import get_search_service_dao, get_elastic_service
from neo4japp.data_transfer_objects import (
    GeneFilteredRequest,
    OrganismRequest,
    PDFSearchRequest,
    SearchRequest,
    SimpleSearchRequest,
    VizSearchRequest
)
from neo4japp.data_transfer_objects.common import ResultList, ResultQuery
from neo4japp.database import get_search_service_dao, db
from neo4japp.exceptions import InvalidArgumentsException
from neo4japp.models import (
    AppUser,
    Directory,
    Projects,
    AppRole,
    projects_collaborator_role,
    Files,
    Project
)
from neo4japp.request_schemas.search import (
    ContentSearchSchema,
)
from neo4japp.util import CamelDictMixin, jsonify_with_class, SuccessResponse
from neo4japp.utils.logger import EventLog
from neo4japp.utils.request import paginate_from_args
from neo4japp.utils.sqlalchemy import ft_search

bp = Blueprint('search', __name__, url_prefix='/search')


@bp.route('/search', methods=['POST'])
@jsonify_with_class(SearchRequest)
def fulltext_search(req: SearchRequest):
    search_dao = get_search_service_dao()
    results = search_dao.fulltext_search(req.query, req.page, req.limit)
    return SuccessResponse(result=results, status_code=200)


@bp.route('/simple-search', methods=['POST'])
@jsonify_with_class(SimpleSearchRequest)
def simple_full_text_search(req: SimpleSearchRequest):
    search_dao = get_search_service_dao()
    results = search_dao.simple_text_search(req.query, req.page, req.limit, req.filter)
    return SuccessResponse(result=results, status_code=200)


# TODO: Added as part of LL-1067, this is a TEMP solution until we design a
# search service consistent with both the visualizer and the drawing tool.
# This will need tests if we decide to maintain it as a standalone service.
@bp.route('/viz-search-temp', methods=['POST'])
@jsonify_with_class(VizSearchRequest)
def visualizer_search_temp(req: VizSearchRequest):
    search_dao = get_search_service_dao()
    results = search_dao.visualizer_search_temp(
        term=req.query,
        organism=req.organism,
        page=req.page,
        limit=req.limit,
        filter=req.filter
    )
    return SuccessResponse(result=results, status_code=200)


# // TODO: Re-enable once we have a proper predictive/autocomplete implemented
# @bp.route('/search', methods=['POST'])
# @jsonify_with_class(SearchRequest)
# def predictive_search(req: SearchRequest):
#     search_dao = get_search_service_dao()
#     results = search_dao.predictive_search(req.query)
#     return SuccessResponse(result=results, status_code=200)

# TODO: Probably should rename this to something else...not sure what though
@bp.route('/content', methods=['GET'])
@auth.login_required
@use_kwargs(ContentSearchSchema)
def search(q, types, limit, page):
    search_term = q
    types = types.split(';')
    offset = (page - 1) * limit
    search_phrases = []

    if search_term:
        match_fields = ['filename', 'description', 'data.content']
        highlight = {
            'fields': {'data.content': {}},
            # Need to be very careful with this option. If fragment_size is too large, search
            # will be slow because elastic has to generate large highlight fragments. Setting to
            # default for now.
            # 'fragment_size': FRAGMENT_SIZE,
            'fragment_size': 0,
            'pre_tags': ['<strong>'],
            'post_tags': ['</strong>'],
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
        query_filter = [  # type:ignore
            {
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
        ]

        elastic_service = get_elastic_service()
        res, search_phrases = elastic_service.search(
            index_id=FILE_INDEX_ID,
            user_query=search_term,
            offset=offset,
            limit=limit,
            match_fields=match_fields,
            query_filter=query_filter,
            highlight=highlight
        )
        res = res['hits']
    else:
        res = {'hits': [], 'max_score': None, 'total': 0}

    results = []
    for doc in res['hits']:
        highlight = None
        if doc.get('highlight', None) is not None:
            if doc['highlight'].get('data.content', None) is not None:
                highlight = doc['highlight']['data.content']
        results.append({
            'item': {
                # TODO LL-1723: Need to add complete file path here
                'type': 'file' if doc['_source']['type'] == 'pdf' else 'map',
                'id': doc['_source']['id'],
                'name': doc['_source']['filename'],
                'description': doc['_source']['description'],
                'highlight': highlight,
                'doi': doc['_source']['doi'],
                'creation_date': doc['_source']['uploaded_date'],
                'project': {
                    'project_name': doc['_source']['project_name'],
                },
                'creator': {
                    'username': doc['_source']['username'],
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
@jsonify_with_class()
def get_organism(organism_tax_id: str):
    search_dao = get_search_service_dao()
    result = search_dao.get_organism_with_tax_id(organism_tax_id)
    return SuccessResponse(result=result, status_code=200)


@bp.route('/organisms', methods=['POST'])
@jsonify_with_class(OrganismRequest)
def get_organisms(req: OrganismRequest):
    search_dao = get_search_service_dao()
    results = search_dao.get_organisms(req.query, req.limit)
    return SuccessResponse(result=results, status_code=200)


@bp.route('/genes_filtered_by_organism_and_others', methods=['POST'])
@jsonify_with_class(GeneFilteredRequest)
def get_genes_filtering_by_organism(req: GeneFilteredRequest):
    search_dao = get_search_service_dao()
    results = search_dao.search_genes_filtering_by_organism_and_others(
        req.query, req.organism_id, req.filters)
    return SuccessResponse(result=results, status_code=200)
