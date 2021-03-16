from flask import Blueprint
from neo4japp.database import get_kg_statistics_service
from neo4japp.exceptions import ServerException


bp = Blueprint('kg-statistics-api', __name__, url_prefix='/kg-statistics')


@bp.route('', methods=['GET'])
def get_knowledge_graph_statistics():
    stat_service = get_kg_statistics_service()
    statistics = stat_service.get_kg_statistics()
    if statistics:
        return statistics, 200
    raise ServerException(
        title='Failed to Statistics',
        message='Knowledge Graph Statistics Not Available.')
