from flask import Blueprint
from http import HTTPStatus

from neo4japp.services.rcache import getcache
from neo4japp.exceptions import ServerException


bp = Blueprint('kg-statistics-api', __name__, url_prefix='/kg-statistics')


@bp.route('/', methods=['GET'])
def get_knowledge_graph_statistics():
    statistics = getcache('kg_statistics')
    if statistics:
        return statistics
    raise ServerException(
        title='Failed to get Statistics',
        message='Knowledge Graph Statistics Not Available.',
        code=HTTPStatus.SERVICE_UNAVAILABLE)
