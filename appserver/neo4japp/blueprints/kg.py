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
from neo4japp.models.common import NEO4JBase

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


@bp.route('/get-ncbi-nodes/biocyc', methods=['POST'])
def get_ncbi_biocyc_nodes():
    data = request.get_json()
    node_ids = data['nodeIds']
    kg = get_kg_service()
    nodes = kg.get_biocyc_genes(node_ids)
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
    biocyc = kg.get_biocyc_genes(node_ids)
    cellular = kg.get_cellular_go_genes(node_ids)
    biological = kg.get_biological_go_genes(node_ids)
    molecular = kg.get_molecular_go_genes(node_ids)
    string = kg.get_string_genes(node_ids)
    uniprot = kg.get_uniprot_genes(node_ids)
    nodes = []
    for i, node_id in enumerate(node_ids):
        node = {'regulon': regulon[i],
                'uniprot': uniprot[i],
                'string': string[i],
                'molecularGo': molecular[i],
                'biologicalGo': biological[i],
                'cellularGo': cellular[i],
                'biocyc': biocyc[i]
                }
        nodes.append(node)
    return jsonify({'result': nodes}), 200


# 3-hydroxyisobutyric Acid to pykF Using ChEBI
@bp.route('/shortest-path-queries/three-hydroxisobuteric-acid-to-pykf-chebi', methods=['GET'])
def three_hydroxisobuteric_acid_to_pykf_chebi():
    kg = get_kg_service()
    result = kg.get_three_hydroxisobuteric_acid_to_pykf_chebi()
    return jsonify({'result': result}), 200


# 3-hydroxyisobutyric Acid to pykF using BioCyc
@bp.route('/shortest-path-queries/three-hydroxisobuteric-acid-to-pykf-biocyc', methods=['GET'])
def three_hydroxisobuteric_acid_to_pykf_biocyc():
    kg = get_kg_service()
    result = kg.get_three_hydroxisobuteric_acid_to_pykf_biocyc()
    return jsonify({'result': result}), 200


# icd to rhsE
@bp.route('/shortest-path-queries/icd-to-rhse', methods=['GET'])
def icd_to_rhse():
    kg = get_kg_service()
    result = kg.get_icd_to_rhse()
    return jsonify({'result': result}), 200


# SIRT5 to NFE2L2 Using Literature Data
@bp.route('/shortest-path-queries/sirt5-to-nfe2l2-literature', methods=['GET'])
def sirt5_to_nfe2l2_literature():
    kg = get_kg_service()
    result = kg.get_sirt5_to_nfe2l2_literature()
    return jsonify({'result': result}), 200


# CTNNB1 to Diarrhea Using Literature Data
@bp.route('/shortest-path-queries/ctnnb1-to-diarrhea-literature', methods=['GET'])
def ctnnb1_to_diarrhea_literature():
    kg = get_kg_service()
    result = kg.get_ctnnb1_to_diarrhea_literature()
    return jsonify({'result': result}), 200


# Two pathways using BioCyc
@bp.route('/shortest-path-queries/two-pathways-biocyc', methods=['GET'])
def two_pathways_biocyc():
    kg = get_kg_service()
    result = kg.get_two_pathways_biocyc()
    return jsonify({'result': result}), 200
