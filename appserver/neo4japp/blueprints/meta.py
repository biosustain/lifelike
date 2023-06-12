from flask import Blueprint, current_app

from neo4japp.blueprints.auth import login_exempt
from neo4japp.data_transfer_objects import BuildInformation
from neo4japp.utils.jsonify import jsonify_with_class
from neo4japp.schemas.common import SuccessResponse

bp = Blueprint('meta', __name__, url_prefix='/meta')


@bp.route('/', methods=['GET'])
@jsonify_with_class()
@login_exempt
def build_version():
    """ Meta API
    Contains a collection of metadata about the application server
    such as the current version of the application or the
    health of the application
    """
    build_timestamp = current_app.config.get('GITHUB_LAST_COMMIT_TIMESTAMP')
    git_commit_hash = current_app.config.get('GITHUB_HASH')
    app_build_number = current_app.config.get('APP_BUILD_NUMBER')
    app_version = current_app.config.get('APP_VERSION')
    result = BuildInformation(
        build_timestamp=build_timestamp,
        git_hash=git_commit_hash,
        app_build_number=app_build_number,
        app_version=app_version,
    )
    return SuccessResponse(result=result, status_code=200)
