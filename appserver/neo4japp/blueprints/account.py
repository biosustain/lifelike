from flask import Blueprint, g, jsonify
from neo4japp.database import get_account_service
from neo4japp.data_transfer_objects import UserCreationRequest
from neo4japp.blueprints.auth import auth
from neo4japp.blueprints.permissions import requires_role
from neo4japp.util import jsonify_with_class, SuccessResponse

bp = Blueprint('accounts', __name__, url_prefix='/accounts')

@bp.route('/', methods=['POST'])
@auth.login_required
@jsonify_with_class(UserCreationRequest)
@requires_role('admin')
def create_user(req: UserCreationRequest):
    account_dao = get_account_service()
    yield g.current_user

    # TODO: Allow for adding specific roles
    new_user = account_dao.create_user(
        username=req.username,
        email=req.email,
        password=req.password,
    )

    yield SuccessResponse(
        result=new_user.to_dict(), status_code=201)


@bp.route('/', methods=['GET'])
@auth.login_required
def list_users():
    account_dao = get_account_service()
    users = [user.to_dict() for user in account_dao.get_user_list()]
    return jsonify(result=users, status_code=200)


@bp.route('/user', methods=['GET'])
@auth.login_required
def current_user():
    """ Returns the current user """
    return jsonify(result=g.current_user.to_dict(), status_code=200)
