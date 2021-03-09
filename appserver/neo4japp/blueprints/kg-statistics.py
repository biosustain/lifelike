from flask import Blueprint

from neo4japp.services.redis import redis_server

bp = Blueprint('kg-statistics-api', __name__, url_prefix='/kg-statistics')


@bp.route('', methods=['GET'])
def get_knowledge_graph_statistics():
    statistics = redis_server.get('kg_statistics')

    if statistics:
        return statistics, 200

    raise ServerException(
        'Failed to Statistics',
        'Knowledge Graph Statistics Not Available.')
