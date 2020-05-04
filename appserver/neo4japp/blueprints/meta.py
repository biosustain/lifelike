from flask import Blueprint, current_app, jsonify
from neo4japp.data_transfer_objects import BuildInformation
from neo4japp.util import SuccessResponse, jsonify_with_class

bp = Blueprint('meta', __name__, url_prefix='/meta')


""" Meta API
Contains a collection of metadata about the application server
such as the current version of the application or the
health of the application
"""
@bp.route('/', methods=['GET'])
@jsonify_with_class()
def build_version():
    build_timestamp = current_app.config.get('BUILD_TIMESTAMP')
    git_commit_hash = current_app.config.get('GITHUB_HASH')
    result = BuildInformation(timestamp=build_timestamp, git_hash=git_commit_hash)
    return SuccessResponse(result=result, status_code=200)
