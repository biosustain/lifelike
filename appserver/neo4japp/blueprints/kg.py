from flask import Blueprint, jsonify

from neo4japp.database import get_kg_service


bp = Blueprint('kg-api', __name__, url_prefix='/knowledge-graph')


@bp.route('/shortest-path-query/<int:query_id>', methods=['GET'])
def get_shortest_path_query_result(query_id):
    kg = get_kg_service()
    result = kg.get_shortest_path_data(query_id)
    return jsonify({'result': result}), 200


@bp.route('/shortest-path-query-list', methods=['GET'])
def get_shortest_path_query_list():
    kg = get_kg_service()
    result = kg.get_shortest_path_query_list()
    return jsonify({'result': result}), 200
