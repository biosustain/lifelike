from flask import Blueprint
from neo4japp.exceptions import DataNotAvailableException
import os
import redis

bp = Blueprint('kg-statistics-api', __name__, url_prefix='/kg-statistics')

redis_server = redis.Redis(
        host=os.environ.get("REDIS_HOST"),
        port=os.environ.get("REDIS_PORT"),
        password=os.environ.get("REDIS_PASSWORD"),
        ssl=os.environ.get("REDIS_SSL", "False") in ["True", "true"],
        decode_responses=True,
    )


@bp.route('', methods=['GET'])
def get_knowledge_graph_statistics():
    statistics = redis_server.get("kg_statistics")

    if statistics:
        return statistics, 200

    raise DataNotAvailableException("")
