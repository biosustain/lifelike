from flask import Blueprint, request, jsonify

from typing import List

from neo4japp.blueprints.auth import auth
from neo4japp.database import get_kg_service

bp = Blueprint('kg-api', __name__, url_prefix='/knowledge-graph')


@bp.route('/get-ncbi-nodes/enrichment-domains', methods=['POST'])
@auth.login_required
def get_ncbi_enrichment_domains():
    """ Find all domains matched to given node id, then return dictionary with all domains as
        result. All domains should have matching indices e.g. regulon[1] should be data from
        matching same node as uniprot[1].
    """
    # TODO: Validate incoming data using webargs + Marshmallow
    data = request.get_json()
    node_ids = data.get('nodeIds')
    tax_id = data.get('taxID')

    nodes = {}

    if node_ids is not None and tax_id is not None:
        kg = get_kg_service()

        regulon = kg.get_regulon_genes(node_ids)
        biocyc = kg.get_biocyc_genes(node_ids, tax_id)
        go = kg.get_go_genes(node_ids)
        string = kg.get_string_genes(node_ids)
        uniprot = kg.get_uniprot_genes(node_ids)

        nodes = {
            node_id: {
                'regulon': regulon[node_id] if regulon.get(node_id) else None,
                'uniprot': uniprot[node_id] if uniprot.get(node_id) else None,
                'string': string[node_id] if string.get(node_id) else None,
                'go': go[node_id] if go.get(node_id) else None,
                'biocyc': biocyc[node_id] if biocyc.get(node_id) else None,
                'node_id': node_id
            } for node_id in node_ids}

    return jsonify({'result': nodes}), 200


@bp.route('/shortest-path-query/<int:query_id>', methods=['GET'])
@auth.login_required
def get_shortest_path_query_result(query_id):
    kg = get_kg_service()
    result = kg.get_shortest_path_data(query_id)
    return jsonify({'result': result}), 200


@bp.route('/shortest-path-query-list', methods=['GET'])
@auth.login_required
def get_shortest_path_query_list():
    kg = get_kg_service()
    result = kg.get_shortest_path_query_list()
    return jsonify({'result': result}), 200
