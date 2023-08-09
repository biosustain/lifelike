from http import HTTPStatus

from flask import Blueprint

from neo4japp.exceptions import ServerException, wrap_exceptions
from neo4japp.services.rcache import get_redis_cache_server


bp = Blueprint('kg-statistics-api', __name__, url_prefix='/kg-statistics')


@bp.route('', methods=['GET'])
@wrap_exceptions(ServerException, title='Failed to get Statistics')
def get_knowledge_graph_statistics():
    statistics = get_redis_cache_server().get('kg_statistics')
    if statistics:
        return statistics, HTTPStatus.OK
    raise ServerException(message='Knowledge Graph Statistics Not Available.')
