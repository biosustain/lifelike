from flask import Blueprint

from neo4japp.services.rcache import redis_server
from neo4japp.exceptions import ServerException, wrap_exceptions


bp = Blueprint('kg-statistics-api', __name__, url_prefix='/kg-statistics')


@bp.route('', methods=['GET'])
@wrap_exceptions(ServerException, title='Failed to get Statistics')
def get_knowledge_graph_statistics():
    statistics = redis_server.get('kg_statistics')
    if statistics:
        return statistics, 200
    raise ServerException(message='Knowledge Graph Statistics Not Available.')
