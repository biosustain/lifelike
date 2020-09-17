import attr

from flask import Blueprint, request

from typing import List
from sqlalchemy.orm.exc import NoResultFound

from neo4japp.constants import ANNOTATION_STYLES_DICT
from neo4japp.database import get_worksheet_viewer_service
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

bp = Blueprint('worksheet-viewer-api', __name__, url_prefix='/worksheet-viewer')


@bp.route('/get-neo4j-worksheet/<string:worksheet_id>', methods=['GET'])
def get_neo4j_worksheet(worksheet_id: str):
    try:
        worksheets = Worksheet.query.filter(Worksheet.id == worksheet_id).one()
    except NoResultFound:
        raise RecordNotFoundException('not found :-( ')

    yield worksheets

    return SuccessResponse(result=worksheets, status_code=200)


@bp.route('/get-ncbi-nodes/<string:worksheet_node_id>', methods=['GET'])
def get_ncbi_nodes(worksheet_node_id: str):
    worksheet_viewer = get_worksheet_viewer_service()
    nodes = worksheet_viewer.get_ncbi_genes(worksheet_node_id)
    return SuccessResponse(result=nodes, status_code=200)


@bp.route('/get-ncbi-nodes/uniprot', methods=['GET'])
def get_ncbi_uniprot_nodes():
    data = request.get_json()
    node_ids = data['nodeIds']
    worksheet_viewer = get_worksheet_viewer_service()
    nodes = worksheet_viewer.get_uniprot_genes(node_ids)
    return SuccessResponse(result=nodes, status_code=200)


@bp.route('/get-ncbi-nodes/string', methods=['GET'])
def get_ncbi_string_nodes():
    data = request.get_json()
    node_ids = data['nodeIds']
    worksheet_viewer = get_worksheet_viewer_service()
    nodes = worksheet_viewer.get_string_genes(node_ids)
    return SuccessResponse(result=nodes, status_code=200)


@bp.route('/get-ncbi-nodes/molecular-go', methods=['GET'])
def get_ncbi_molecular_go_nodes():
    data = request.get_json()
    node_ids = data['nodeIds']
    worksheet_viewer = get_worksheet_viewer_service()
    nodes = worksheet_viewer.get_molecular_go_genes(node_ids)
    return SuccessResponse(result=nodes, status_code=200)


@bp.route('/get-ncbi-nodes/biological-go', methods=['GET'])
def get_ncbi_biological_go_nodes():
    data = request.get_json()
    node_ids = data['nodeIds']
    worksheet_viewer = get_worksheet_viewer_service()
    nodes = worksheet_viewer.get_biological_go_genes(node_ids)
    return SuccessResponse(result=nodes, status_code=200)


@bp.route('/get-ncbi-nodes/cellular-go', methods=['GET'])
def get_ncbi_cellular_go_nodes():
    data = request.get_json()
    node_ids = data['nodeIds']
    worksheet_viewer = get_worksheet_viewer_service()
    nodes = worksheet_viewer.get_cellular_go_genes(node_ids)
    return SuccessResponse(result=nodes, status_code=200)


@bp.route('/get-ncbi-nodes/ecocyc', methods=['GET'])
def get_ncbi_ecocyc_nodes():
    data = request.get_json()
    node_ids = data['nodeIds']
    worksheet_viewer = get_worksheet_viewer_service()
    nodes = worksheet_viewer.get_ecocyc_genes(node_ids)
    return SuccessResponse(result=nodes, status_code=200)


@bp.route('/get-ncbi-nodes/regulon', methods=['GET'])
def get_ncbi_regulon_nodes():
    data = request.get_json()
    node_ids = data['nodeIds']
    worksheet_viewer = get_worksheet_viewer_service()
    nodes = worksheet_viewer.get_regulon_genes(node_ids)
    return SuccessResponse(result=nodes, status_code=200)
