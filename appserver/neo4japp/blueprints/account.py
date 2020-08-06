from flask import Blueprint, g, jsonify
from sqlalchemy.orm.exc import NoResultFound
from neo4japp.exceptions import NotAuthorizedException
from neo4japp.database import get_account_service, get_projects_service
from neo4japp.models import AppRole, AppUser, Projects
from neo4japp.data_transfer_objects import UserRequest, UserUpdateRequest
from neo4japp.blueprints.auth import auth
from neo4japp.blueprints.permissions import requires_role
from neo4japp.util import jsonify_with_class, SuccessResponse

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
@bp.route('/<username>', methods=['GET'])
@auth.login_required
def list_users(username=""):
    account_dao = get_account_service()
    users = [user.to_dict() for user in account_dao.get_user_list(username)]
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
