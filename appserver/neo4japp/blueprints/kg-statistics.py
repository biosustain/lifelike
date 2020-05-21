from collections import defaultdict
from flask import Blueprint, jsonify
from neo4japp.database import get_neo4j
from neo4japp.exceptions import DataNotAvailableException
import os
import redis
import json
import time

bp = Blueprint('kg-statistics-api', __name__, url_prefix='/kg-statistics')

redis_server = redis.Redis(
    connection_pool=redis.BlockingConnectionPool(
        host=os.environ.get("REDIS_HOST"),
        port=os.environ.get("REDIS_PORT"),
        decode_responses=True)
)


@bp.route('', methods=['GET'])
def get_knowledge_graph_statistics():
    statistics = redis_server.get("kg_statistics")

    if statistics:
        return statistics, 200

    raise DataNotAvailableException("")
