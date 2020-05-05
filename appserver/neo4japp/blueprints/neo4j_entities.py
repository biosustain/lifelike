import os
from collections import defaultdict
from flask import Blueprint, jsonify
from neo4japp.database import get_neo4j

bp = Blueprint('neo4j-entities-api', __name__, url_prefix='/neo4j-entities')

@bp.route('/statistics', methods=['GET'])
def get_knowledge_graph_statistics():
    # domains and entities are hard-coded for now, as there is no way to distinguish
    # whether node's labels are databases or entities
    graph = get_neo4j()
    domains = set(['BioCyc', 'CHEBI', 'NCBI', 'RegulonDB', 'GO'])
    entities = set([
        'Compound', 'DNABindingSite', 'EnzReaction', 'Gene', 'Operon',
        'Pathway', 'Product', 'Promoter', 'Protein', 'Reaction', 'Regulon',
        'Terminator', 'TranscriptionFactor', 'TranscriptionUnit'
    ])
    response = defaultdict(lambda: defaultdict(int))
    result = graph.run("match (n) return labels(n) as labels, count(n) as count").data()
    for row in result:
        labels = set(row["labels"])
        domain = domains & labels
        entity = entities & labels
        if domain and entity:
            response[domain.pop()][entity.pop()] += row["count"]
        if 'CHEBI' in row['labels']:
            response['CHEBI']['Compound'] += row["count"]
    return jsonify(response)
