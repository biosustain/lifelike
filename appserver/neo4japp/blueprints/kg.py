import attr

from flask import Blueprint, request, jsonify

from typing import List
from sqlalchemy.orm.exc import NoResultFound

from neo4japp.blueprints.auth import auth
from neo4japp.constants import ANNOTATION_STYLES_DICT
from neo4japp.database import get_kg_service
from neo4japp.models import (
    Worksheet
)
from neo4japp.data_transfer_objects.visualization import (
    ExpandNodeRequest,
    GetSnippetsForEdgeRequest,
    GetSnippetsForClusterRequest,
    ReferenceTableDataRequest,
)
from neo4japp.exceptions import (
    InvalidFileNameException, RecordNotFoundException, NotAuthorizedException
)
from neo4japp.util import CamelDictMixin, SuccessResponse, jsonify_with_class
from neo4japp.models.common import NEO4JBase

bp = Blueprint('kg-api', __name__, url_prefix='/knowledge-graph')


@bp.route('/get-ncbi-nodes/uniprot', methods=['POST'])
@auth.login_required
def get_ncbi_uniprot_nodes():
    data = request.get_json()
    node_ids = data['nodeIds']
    kg = get_kg_service()
    nodes = kg.get_uniprot_genes(node_ids)
    return jsonify({'result': nodes}), 200


@bp.route('/get-ncbi-nodes/string', methods=['POST'])
@auth.login_required
def get_ncbi_string_nodes():
    data = request.get_json()
    node_ids = data['nodeIds']
    kg = get_kg_service()
    nodes = kg.get_string_genes(node_ids)
    return jsonify({'result': nodes}), 200


@bp.route('/get-ncbi-nodes/molecular-go', methods=['POST'])
@auth.login_required
def get_ncbi_molecular_go_nodes():
    data = request.get_json()
    node_ids = data['nodeIds']
    kg = get_kg_service()
    nodes = kg.get_molecular_go_genes(node_ids)
    return jsonify({'result': nodes}), 200


@bp.route('/get-ncbi-nodes/biological-go', methods=['POST'])
@auth.login_required
def get_ncbi_biological_go_nodes():
    data = request.get_json()
    node_ids = data['nodeIds']
    kg = get_kg_service()
    nodes = kg.get_biological_go_genes(node_ids)
    return jsonify({'result': nodes}), 200


@bp.route('/get-ncbi-nodes/cellular-go', methods=['POST'])
@auth.login_required
def get_ncbi_cellular_go_nodes():
    data = request.get_json()
    node_ids = data['nodeIds']
    kg = get_kg_service()
    nodes = kg.get_cellular_go_genes(node_ids)
    return jsonify({'result': nodes}), 200


@bp.route('/get-ncbi-nodes/biocyc', methods=['POST'])
@auth.login_required
def get_ncbi_biocyc_nodes():
    data = request.get_json()
    node_ids = data['nodeIds']
    kg = get_kg_service()
    nodes = kg.get_biocyc_genes(node_ids)
    return jsonify({'result': nodes}), 200


@bp.route('/get-ncbi-nodes/regulon', methods=['POST'])
@auth.login_required
def get_ncbi_regulon_nodes():
    data = request.get_json()
    node_ids = data['nodeIds']
    kg = get_kg_service()
    nodes = kg.get_regulon_genes(node_ids)
    return jsonify({'result': nodes}), 200


# Find all domains matched to given node id, then return dictionary with all domains as result.
# All domains should have matching indices e.g. regulon[1] should be data from matching same node
# as uniprot[1].
@bp.route('/get-ncbi-nodes/enrichment-domains', methods=['POST'])
@auth.login_required
def get_ncbi_enrichment_domains():
    data = request.get_json()
    node_ids = data['nodeIds']
    taxID = data['taxID']
    kg = get_kg_service()
    regulon = kg.get_regulon_genes(node_ids)
    biocyc = kg.get_biocyc_genes(node_ids, taxID)
    go = kg.get_go_genes(node_ids)
    string = kg.get_string_genes(node_ids)
    uniprot = kg.get_uniprot_genes(node_ids)
    nodes = []
    for i, node_id in enumerate(node_ids):
        node = {'regulon': regulon[i],
                'uniprot': uniprot[i],
                'string': string[i],
                'go': go[i],
                'biocyc': biocyc[i],
                'node_id': node_id
                }
        nodes.append(node)
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
