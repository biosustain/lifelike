import re

from flask import Blueprint, g, jsonify, request
from flask.views import MethodView
from sqlalchemy import or_, func
from sqlalchemy.orm.exc import NoResultFound
from webargs.flaskparser import use_args

from neo4japp.blueprints.auth import auth
from neo4japp.blueprints.permissions import requires_role
from neo4japp.data_transfer_objects import UserRequest, UserUpdateRequest
from neo4japp.database import get_account_service, get_projects_service, db
from neo4japp.exceptions import NotAuthorizedException
from neo4japp.models import AppRole, AppUser, Projects
from neo4japp.schemas.account import UserListSchema, UserSearchSchema
from neo4japp.schemas.common import PaginatedRequestSchema
from neo4japp.util import jsonify_with_class, SuccessResponse
from neo4japp.utils.request import Pagination

bp = Blueprint('accounts', __name__, url_prefix='/accounts')


@bp.route('/', methods=['POST'])
@auth.login_required
@jsonify_with_class(UserRequest)
@requires_role('admin')
def create_user(req: UserRequest):
    account_dao = get_account_service()
    proj_service = get_projects_service()

    yield g.current_user

    # TODO: Allow for adding specific roles
    new_user = account_dao.create_user(
        first_name=req.first_name,
        last_name=req.last_name,
        username=req.username,
        email=req.email,
        password=req.password,
    )

    # TODO: Deprecate this once we have a GUI for adding users to projects
    # Currently will add any new user to a global project with WRITE permission
    default_projects = Projects.query.filter(Projects.project_name == 'beta-project').one()
    write_role = AppRole.query.filter(AppRole.name == 'project-write').one()
    proj_service.add_collaborator(new_user, write_role, default_projects)

    yield SuccessResponse(
        result=new_user.to_dict(), status_code=201)


@bp.route('/', methods=['GET'])
@auth.login_required
def list_users():
    """
       Currently only support query around username
       The paramters must be laid in order by how list
       of fields and filters align into key, val pair
    """

    fields = request.args.getlist('fields')
    fields = fields if len(fields) else ['email']
    filters = request.args.getlist('filters')
    filters = filters if len(filters) else ['']

    query_dict = dict(zip(fields, filters))

    account_dao = get_account_service()
    users = [user.to_dict() for user in account_dao.get_user_list(query_dict)]
    return jsonify(result=users, status_code=200)


@bp.route('/user', methods=['GET'])
@auth.login_required
def get_user():
    """ Returns the current user """
    return jsonify(result=g.current_user.to_dict(), status_code=200)


@bp.route('/user', methods=['POST', 'PUT'])
@auth.login_required
@jsonify_with_class(UserUpdateRequest)
def update_user(req: UserUpdateRequest):
    """ Updates the current user """
    account_dao = get_account_service()
    try:
        appuser = AppUser.query.filter_by(username=req.username).one()
        updated_user = account_dao.update_user(appuser, req)
    except NoResultFound:
        raise NotAuthorizedException('user does not exist')
    return SuccessResponse(result=updated_user.to_dict(), status_code=200)


class AccountSearchView(MethodView):
    decorators = [auth.login_required]

    @use_args(UserSearchSchema)
    @use_args(PaginatedRequestSchema)
    def post(self, params: dict, pagination: Pagination):
        """Endpoint to search for users that match certain criteria."""
        current_user = g.current_user
        query = re.sub("[%_]", "\\\\0", params['query'].strip().lower())
        like_query = f"%{query}%"

        query = db.session.query(AppUser) \
            .filter(or_(func.lower(AppUser.first_name).like(like_query),
                        func.lower(AppUser.last_name).like(like_query),
                        func.lower(AppUser.username).like(like_query),
                        func.lower(AppUser.email) == query,
                        func.lower(AppUser.hash_id) == query))

        if params['exclude_self']:
            query = query.filter(AppUser.id != current_user.id)

        paginated_result = query.paginate(pagination.page, pagination.limit, False)

        return jsonify(UserListSchema().dump({
            'total': paginated_result.total,
            'results': paginated_result.items,
        }))


bp.add_url_rule('/search', view_func=AccountSearchView.as_view('account_search'))
