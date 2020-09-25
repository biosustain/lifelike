import attr

from flask import Blueprint, request, jsonify

from typing import List
from sqlalchemy.orm.exc import NoResultFound

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

bp = Blueprint('kg-api', __name__, url_prefix='/knowledge-graph')


@bp.route('/get-ncbi-nodes/uniprot', methods=['POST'])
def get_ncbi_uniprot_nodes():
    data = request.get_json()
    node_ids = data['nodeIds']
    kg = get_kg_service()
    nodes = kg.get_uniprot_genes(node_ids)
    return jsonify({'result': nodes}), 200


@bp.route('/get-ncbi-nodes/string', methods=['POST'])
def get_ncbi_string_nodes():
    data = request.get_json()
    node_ids = data['nodeIds']
    kg = get_kg_service()
    nodes = kg.get_string_genes(node_ids)
    return jsonify({'result': nodes}), 200


@bp.route('/get-ncbi-nodes/molecular-go', methods=['POST'])
def get_ncbi_molecular_go_nodes():
    data = request.get_json()
    node_ids = data['nodeIds']
    kg = get_kg_service()
    nodes = kg.get_molecular_go_genes(node_ids)
    return jsonify({'result': nodes}), 200


@bp.route('/get-ncbi-nodes/biological-go', methods=['POST'])
def get_ncbi_biological_go_nodes():
    data = request.get_json()
    node_ids = data['nodeIds']
    kg = get_kg_service()
    nodes = kg.get_biological_go_genes(node_ids)
    return jsonify({'result': nodes}), 200


@bp.route('/get-ncbi-nodes/cellular-go', methods=['POST'])
def get_ncbi_cellular_go_nodes():
    data = request.get_json()
    node_ids = data['nodeIds']
    kg = get_kg_service()
    nodes = kg.get_cellular_go_genes(node_ids)
    return jsonify({'result': nodes}), 200


@bp.route('/get-ncbi-nodes/ecocyc', methods=['POST'])
def get_ncbi_ecocyc_nodes():
    data = request.get_json()
    node_ids = data['nodeIds']
    kg = get_kg_service()
    nodes = kg.get_ecocyc_genes(node_ids)
    return jsonify({'result': nodes}), 200


@bp.route('/get-ncbi-nodes/regulon', methods=['POST'])
def get_ncbi_regulon_nodes():
    data = request.get_json()
    node_ids = data['nodeIds']
    kg = get_kg_service()
    nodes = kg.get_regulon_genes(node_ids)
    return jsonify({'result': nodes}), 200

@bp.route('/get-ncbi-nodes/enrichment-domains', methods=['POST'])
def get_ncbi_enrichment_domains():
    data = request.get_json()
    node_ids = data['nodeIds']
    kg = get_kg_service()
    regulon = kg.get_regulon_genes(node_ids)
    ecocyc = kg.get_ecocyc_genes(node_ids)
    cellular = kg.get_cellular_go_genes(node_ids)
    biological = kg.get_biological_go_genes(node_ids)
    molecular = kg.get_molecular_go_genes(node_ids)
    string = kg.get_string_genes(node_ids)
    uniprot = kg.get_uniprot_genes(node_ids)
    nodes = list(zip(regulon, uniprot, string, molecular, biological, cellular, ecocyc))
    return jsonify({'result': nodes}), 200
