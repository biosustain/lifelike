from flask import Blueprint, jsonify, request
from neo4japp.database import get_neo4j_service_dao

bp = Blueprint('neo4j-api', __name__, url_prefix='/graph')

@bp.route('/', methods=['POST'])
def run_cypher():
    dao = get_neo4j_service_dao()
    query = request.get_json()
    # TODO: Sanitize the queries
    result = dao.execute_cypher(query['query'])
    return jsonify({'result': result}), 200

