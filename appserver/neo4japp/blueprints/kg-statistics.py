from flask import Blueprint
from neo4japp.database import get_kg_statistics_service
from neo4japp.exceptions import DataNotAvailableException

bp = Blueprint('kg-statistics-api', __name__, url_prefix='/kg-statistics')


@bp.route('', methods=['GET'])
def get_knowledge_graph_statistics():
    stat_service = get_kg_statistics_service()
    statistics = stat_service.get_cache_data('kg_statistics')

    if statistics:
        return statistics, 200

    raise DataNotAvailableException("")
