import attr
import sqlalchemy
from flask import Blueprint, request, jsonify, g
from sqlalchemy.orm import aliased

from neo4japp.blueprints.auth import auth
from neo4japp.database import get_search_service_dao, get_elastic_service
from neo4japp.data_transfer_objects import (
    GeneFilteredRequest,
    OrganismRequest,
    PDFSearchRequest,
    SearchRequest,
    SimpleSearchRequest,
    VizSearchRequest
)
from neo4japp.data_transfer_objects.common import ResultList
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
from neo4japp.services.elastic import FILE_INDEX_ID, FRAGMENT_SIZE
from neo4japp.util import CamelDictMixin, jsonify_with_class, SuccessResponse
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
@bp.route('/pdf-search', methods=['POST'])
@auth.login_required
@jsonify_with_class(PDFSearchRequest)
def search(req: PDFSearchRequest):
    if req.query:
        match_fields = ['filename', 'data.content']
        boost_fields = ['filename^3', 'description^3']
        highlight = {
            'require_field_match': 'false',
            'fields': {'*': {}},
            'fragment_size': FRAGMENT_SIZE,
            'pre_tags': ['<highlight>'],
            'post_tags': ['</highlight>'],
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
                    t_project_role.name == 'project-admin'
                )
            )
        )

        accessible_project_ids = [project_id for project_id, in query]
        query_filter = [  # type:ignore
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

        elastic_service = get_elastic_service()
        res = elastic_service.search(
            index_id=FILE_INDEX_ID,
            user_query=req.query,
            offset=req.offset,
            limit=req.limit,
            match_fields=match_fields,
            boost_fields=boost_fields,
            query_filter=query_filter,
            highlight=highlight
        )['hits']
    else:
        res = {'hits': [], 'max_score': None, 'total': 0}

    # TODO Frontend hasn't yet been reworked to expect the response as it currently is, refactoring
    # the frontend will happen in later tickets
    return SuccessResponse(result=res, status_code=200)


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


@bp.route('/content', methods=['GET'])
@auth.login_required
def search_content():
    types = request.args.get('types', ';')
    q = request.args.get('q', '')
    user_id = g.current_user.id

    t_owner = aliased(AppUser)
    t_directory = aliased(Directory)
    t_project = aliased(Projects)
    t_project_role_role = aliased(AppRole)
    t_project_role_user = aliased(AppUser)

    # Role table used to check if we have permission
    project_role_sq = db.session.query(projects_collaborator_role.c.projects_id,
                                       projects_collaborator_role.c.appuser_id,
                                       t_project_role_role.name) \
        .join(t_project_role_role,
              t_project_role_role.id == projects_collaborator_role.c.app_role_id) \
        .subquery()

    queries = []

    # Map subquery
    if 'maps' in types:
        map_query = db.session.query(Project.hash_id.label('id'),
                                     Project.label.label('name'),
                                     Project.description.label('description'),
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
            .outerjoin(project_role_sq, project_role_sq.c.projects_id == t_project.id) \
            .filter(sqlalchemy.or_(Project.public.is_(True),
                                   sqlalchemy.and_(project_role_sq.c.appuser_id == user_id,
                                                   sqlalchemy.or_(
                                                       project_role_sq.c.name == 'project-read',
                                                       project_role_sq.c.name == 'project-admin'))))
        map_query = ft_search(map_query, q)
        queries.append(map_query)

    # File subquery
    if 'documents' in types:
        file_query = db.session.query(Files.file_id.label('id'),
                                      Files.filename.label('name'),
                                      Files.description.label('description'),
                                      Files.creation_date.label('creation_date'),
                                      Files.modified_date.label('modification_date'),
                                      t_owner.id.label('owner_id'),
                                      t_owner.username.label('owner_username'),
                                      t_owner.first_name.label('owner_first_name'),
                                      t_owner.last_name.label('owner_last_name'),
                                      t_project.project_name.label('project_name'),
                                      sqlalchemy.literal_column('\'file\'').label('type'),
                                      sqlalchemy.literal_column('1').label('rank')) \
            .join(t_owner, t_owner.id == Files.user_id) \
            .join(t_directory, t_directory.id == Files.dir_id) \
            .join(t_project, t_project.id == t_directory.projects_id) \
            .outerjoin(project_role_sq, project_role_sq.c.projects_id == t_project.id) \
            .filter(sqlalchemy.and_(project_role_sq.c.appuser_id == user_id,
                                    sqlalchemy.or_(project_role_sq.c.name == 'project-read',
                                                   project_role_sq.c.name == 'project-admin')))
        file_query = file_query.filter(
            sqlalchemy.func.lower(Files.filename).like(f'%{q.lower()}%')
        )  # TODO: Make FT
        queries.append(file_query)

    if not len(queries):
        raise InvalidArgumentsException('Missing types', fields={
            'type': ['No accepted type specified'],
        })

    # Combine results
    combined_query = sqlalchemy.union_all(*queries).alias('combined_results')

    # Distinct and order
    base_query = db.session.query(combined_query).order_by(
        sqlalchemy.desc(combined_query.c.rank)
    ).distinct()

    # Paginate
    query = paginate_from_args(
        base_query,
        request.args,
        columns={
            'rank': combined_query.c.rank,
        },
        default_sort='-rank',
        upper_limit=200
    )

    # Convert results into list of dicts
    keys = [item['name'] for item in base_query.column_descriptions]
    results = [dict(zip(keys, item)) for item in query.items]

    response = ResultList(
        total=query.total,
        results=[{
            'item': {
                'type': item['type'],
                'id': item['id'],
                'name': item['name'],
                'description': item['description'],
                'creation_date': item['creation_date'],
                'modification_date': item['modification_date'],
                'project': {
                    'project_name': item['project_name'],
                },
                'creator': {
                    'id': item['owner_id'],
                    'username': item['owner_username'],
                    'first_name': item['owner_first_name'],
                    'last_name': item['owner_last_name'],
                },
            },
            'rank': item['rank'],
        } for item in results])

    return jsonify(response.to_dict())
