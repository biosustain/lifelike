import re

from flask import Blueprint, g, jsonify, request
from flask.views import MethodView
from sqlalchemy import or_, func
from sqlalchemy.orm.exc import NoResultFound
from webargs.flaskparser import use_args

from neo4japp.blueprints.auth import auth
from neo4japp.blueprints.permissions import requires_role
from neo4japp.data_transfer_objects import UserRequest, UserUpdateRequest
from neo4japp.database import get_account_service, get_projects_service, db, \
    get_authorization_service
from neo4japp.exceptions import NotAuthorizedException
from neo4japp.models import AppRole, AppUser, Projects
from neo4japp.schemas.account import (
    UserListSchema,
    UserSearchSchema,
    UserSchemaWithId,
    UserCreateSchema
)
from neo4japp.schemas.common import PaginatedRequestSchema
from neo4japp.util import jsonify_with_class, SuccessResponse
from neo4japp.utils.request import Pagination

bp = Blueprint('accounts', __name__, url_prefix='/accounts')


@bp.route('/', methods=['POST'])
@auth.login_required
@use_args(UserCreateSchema)
@requires_role('admin')
def create_user(args):
    account_dao = get_account_service()

    yield g.current_user

    # TODO: Allow for adding specific roles
    new_user = account_dao.create_user(
        first_name=args['first_name'],
        last_name=args['last_name'],
        username=args['username'],
        email=args['email'],
        password=args['password']
    )

    yield jsonify(dict(result=new_user.to_dict())), 201


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
    users = [
        {**user.to_dict(), **{'roles': [roles]}}
        for user, roles in account_dao.get_user_list(query_dict)
    ]
    return jsonify(result=users, status_code=200)


@bp.route('/user', methods=['GET'])
@auth.login_required
def get_user():
    """ Returns the current user """
    user = g.current_user
    return jsonify(UserSchemaWithId().dump({
        'id': user.id,
        'hash_id': user.hash_id,
        'username': user.username,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'roles': [u.name for u in user.roles],
    })), 200


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
        """
        Endpoint to search for users that match certain criteria.

        This endpoint is used to populate user auto-completes, which is used (as of writing)
        on the project collaborators dialog.
        """
        current_user = g.current_user
        query = re.sub("[%_]", "\\\\0", params['query'].strip())
        like_query = f"%{query}%"

        private_data_access = get_authorization_service().has_role(
            current_user, 'private-data-access'
        )

        # This method is inherently dangerous because it allows users to query
        # our entire database of users. For that reason, we only allow exact
        # email address searches at least
        query = db.session.query(AppUser) \
            .filter(or_(AppUser.first_name.ilike(like_query),
                        AppUser.last_name.ilike(like_query),
                        AppUser.username.ilike(like_query),
                        AppUser.email == query,
                        AppUser.hash_id == query))

        # On the project collaborators dialog, we exclude ourselves because you can't
        # (as of writing) change your own permission level, but if you have the private-data-access
        # role, you need to be able to do that
        if not private_data_access and params['exclude_self']:
            query = query.filter(AppUser.id != current_user.id)

        paginated_result = query.paginate(pagination.page, pagination.limit, False)

        return jsonify(UserListSchema().dump({
            'total': paginated_result.total,
            'results': paginated_result.items,
        }))


bp.add_url_rule('/search', view_func=AccountSearchView.as_view('account_search'))
