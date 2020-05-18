import os
from collections import defaultdict
from flask import Blueprint, jsonify
from neo4japp.database import get_neo4j

bp = Blueprint('kg-statistics-api', __name__, url_prefix='/kg-statistics')


@bp.route('', methods=['GET'])
def get_knowledge_graph_statistics():
    graph = get_neo4j()
    labels_raw = graph.run("call db.labels()").data()
    labels = [label['label'] for label in labels_raw]
    domains = set([label for label in labels if label.startswith('db_')])
    entities = set([label for label in labels if not label.startswith('db_')])
    response = defaultdict(lambda: defaultdict(int))
    result = graph.run("match (n) return labels(n) as labels, count(n) as count").data()
    for row in result:
        labels = set(row["labels"])
        domain = domains & labels
        entity = entities & labels
        if domain and entity:
            response[domain.pop()][entity.pop()] += row["count"]
    response = dict((db_name[3:], count) for db_name, count in response.items())
    return jsonify(response)
