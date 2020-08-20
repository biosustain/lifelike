import attr
import sqlalchemy
from flask import Blueprint, request, jsonify, g
from sqlalchemy.orm import aliased

from neo4japp.blueprints.auth import auth
from neo4japp.data_transfer_objects import DirectoryContent
from neo4japp.data_transfer_objects.common import ResultList
from neo4japp.database import get_search_service_dao, db
from neo4japp.models import AppUser, Directory, Projects, AppRole, projects_collaborator_role, Files, Project
from neo4japp.services.pdf_search import PDFSearch
from neo4japp.util import CamelDictMixin, jsonify_with_class, SuccessResponse
from neo4japp.utils.request import paginate_from_args
from neo4japp.utils.sqlalchemy import ft_search

bp = Blueprint('search', __name__, url_prefix='/search')


@attr.s(frozen=True)
class SearchRequest(CamelDictMixin):
    query: str = attr.ib()
    page: int = attr.ib()
    limit: int = attr.ib()


@attr.s(frozen=True)
class SimpleSearchRequest(CamelDictMixin):
    query: str = attr.ib()
    page: int = attr.ib()
    limit: int = attr.ib()
    filter: str = attr.ib()


@attr.s(frozen=True)
class PDFSearchRequest(CamelDictMixin):
    query: str = attr.ib()
    offset: int = attr.ib()
    limit: int = attr.ib()


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
@jsonify_with_class(SimpleSearchRequest)
def visualizer_search_temp(req: SimpleSearchRequest):
    search_dao = get_search_service_dao()
    results = search_dao.visualizer_search_temp(req.query, req.page, req.limit, req.filter)
    return SuccessResponse(result=results, status_code=200)


# // TODO: Re-enable once we have a proper predictive/autocomplete implemented
# @bp.route('/search', methods=['POST'])
# @jsonify_with_class(SearchRequest)
# def predictive_search(req: SearchRequest):
#     search_dao = get_search_service_dao()
#     results = search_dao.predictive_search(req.query)
#     return SuccessResponse(result=results, status_code=200)

@bp.route('/pdf-search', methods=['POST'])
@auth.login_required
@jsonify_with_class(PDFSearchRequest)
def search(req: PDFSearchRequest):
    if req.query:
        res = PDFSearch().search(
            user_query=req.query,
            offset=req.offset,
            limit=req.limit,
        )['hits']
    else:
        res = {'hits': [], 'max_score': None, 'total': 0}
    return SuccessResponse(result=res, status_code=200)


@bp.route('/content', methods=['GET'])
@auth.login_required
def search_content():
    q = request.args.get('q', '')
    user_id = g.current_user.id

    t_owner = aliased(AppUser)
    t_directory = aliased(Directory)
    t_project = aliased(Projects)
    t_project_role_role = aliased(AppRole)
    t_project_role_user = aliased(AppUser)

    # Role table used to check if we have permission
    project_role_sq = db.session.query(projects_collaborator_role) \
        .join(t_project_role_role, t_project_role_role.id == projects_collaborator_role.c.app_role_id) \
        .join(t_project_role_user, t_project_role_user.id == projects_collaborator_role.c.appuser_id) \
        .subquery()

    # Map subquery
    map_query = db.session.query(Project.id.label('id'),
                                 Project.label.label('name'),
                                 Project.description.label('description'),
                                 sqlalchemy.literal_column('NULL').label('creation_date'),
                                 Project.date_modified.label('modification_date'),
                                 t_owner.id.label('owner_id'),
                                 t_owner.username.label('owner_username'),
                                 t_owner.first_name.label('owner_first_name'),
                                 t_owner.last_name.label('owner_last_name'),
                                 sqlalchemy.literal_column('\'map\'').label('type')) \
        .join(t_owner, t_owner.id == Project.user_id) \
        .join(t_directory, t_directory.id == Project.dir_id) \
        .join(t_project, t_project.id == t_directory.projects_id) \
        .outerjoin(project_role_sq, project_role_sq.c.projects_id == t_project.id) \
        .filter(sqlalchemy.or_(Project.public == True,
                               sqlalchemy.and_(t_project_role_user.id == user_id,
                                               t_project_role_role.name == 'project-read')))

    # File subquery
    file_query = db.session.query(Files.id.label('id'),
                                  Files.filename.label('name'),
                                  Files.description.label('description'),
                                  Files.creation_date.label('creation_date'),
                                  sqlalchemy.literal_column('NULL').label('modification_date'),
                                  t_owner.id.label('owner_id'),
                                  t_owner.username.label('owner_username'),
                                  t_owner.first_name.label('owner_first_name'),
                                  t_owner.last_name.label('owner_last_name'),
                                  sqlalchemy.literal_column('\'file\'').label('type'),
                                  sqlalchemy.literal_column('1').label('rank')) \
        .join(t_owner, t_owner.id == Files.user_id) \
        .join(t_directory, t_directory.id == Files.dir_id) \
        .join(t_project, t_project.id == t_directory.projects_id) \
        .outerjoin(project_role_sq, project_role_sq.c.projects_id == t_project.id) \
        .filter(sqlalchemy.and_(t_project_role_user.id == user_id,
                                t_project_role_role.name == 'project-read'))

    # Apply search
    map_query = ft_search(map_query, q)
    file_query = file_query.filter(sqlalchemy.func.lower(Files.filename).like(f'%{q.lower()}%')) # TODO: Make FT

    # Combine results
    combined_query = sqlalchemy.union_all(map_query, file_query).alias('combined_results')

    # Distinct and order
    base_query = db.session.query(combined_query).order_by(sqlalchemy.desc(combined_query.c.rank)).distinct()

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
                'id': item['id'],
                'name': item['name'],
                'description': item['description'],
                'creation_date': item['creation_date'],
                'modification_date': item['modification_date'],
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
