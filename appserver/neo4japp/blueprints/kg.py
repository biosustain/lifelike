from flask import Blueprint, request, jsonify
from pandas import DataFrame, concat

from neo4japp.constants import KGDomain
from neo4japp.database import get_kg_service
import numpy as np

bp = Blueprint('kg-api', __name__, url_prefix='/knowledge-graph')

@bp.route('/get-ncbi-nodes/enrichment-domains', methods=['POST'])
def get_ncbi_enrichment_domains():
    """ Find all domains matched to given node id, then return dictionary with all domains as
        result. All domains should have matching indices e.g. regulon[1] should be data from
        matching same node as uniprot[1].
    """
    # TODO: Validate incoming data using webargs + Marshmallow
    data = request.get_json()
    node_ids = data.get('nodeIds')
    tax_id = data.get('taxID')
    domains = data.get('domains')

    if node_ids is not None and tax_id is not None:
        kg = get_kg_service()
        domain_nodes = {
            domain.lower(): kg.get_genes(KGDomain(domain), node_ids, tax_id) for domain in domains
        }
        df = DataFrame(domain_nodes).replace({np.nan:None}).transpose()
        # Redundant but just following old implementation
        nodes = df.append(df.columns.to_series(name='node_id')).to_dict()
    else:
        nodes = {}

    # regulon = kg.get_regulon_genes(node_ids) if KGDomain.REGULON.value in domains else {}
    # biocyc = kg.get_biocyc_genes(node_ids, tax_id) if KGDomain.BIOCYC.value in domains else {}
    # go = kg.get_go_genes(node_ids) if KGDomain.GO.value in domains else {}
    # string = kg.get_string_genes(node_ids) if KGDomain.STRING.value in domains else {}
    # uniprot = kg.get_uniprot_genes(node_ids) if KGDomain.UNIPROT.value in domains else {}
    # # kegg = kg.get_kegg_genes(node_ids) if Domain.KEGG.value in domains else {}
    #
    # nodes = {
    #     node_id: {
    #         'regulon': regulon.get(node_id, None),
    #         'uniprot': uniprot.get(node_id, None),
    #         'string': string.get(node_id, None),
    #         'go': go.get(node_id, None),
    #         'biocyc': biocyc.get(node_id, None),
    #         # 'kegg': kegg.get(node_id, None),
    #         'node_id': node_id
    #     } for node_id in node_ids
    # }

    return jsonify({'result': nodes}), 200


@bp.route('/shortest-path-query/<int:query_id>', methods=['GET'])
def get_shortest_path_query_result(query_id):
    kg = get_kg_service()
    result = kg.get_shortest_path_data(query_id)
    return jsonify({'result': result}), 200


@bp.route('/shortest-path-query-list', methods=['GET'])
def get_shortest_path_query_list():
    kg = get_kg_service()
    result = kg.get_shortest_path_query_list()
    return jsonify({'result': result}), 200
