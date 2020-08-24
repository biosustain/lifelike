import attr

from flask import Blueprint, request

from typing import List

from neo4japp.blueprints import GraphRequest
from neo4japp.constants import *
from neo4japp.database import get_neo4j_service_dao

from neo4japp.data_transfer_objects.visualization import (
    GetSnippetsForEdgeRequest,
    GetSnippetsForClusterRequest,
    ReferenceTableDataRequest,
)
from neo4japp.util import CamelDictMixin, SuccessResponse, jsonify_with_class

bp = Blueprint('neo4j-api', __name__, url_prefix='/neo4j')


@attr.s(frozen=True)
class ReactionRequest(CamelDictMixin):
    biocyc_id: int = attr.ib()


@attr.s(frozen=True)
class ExpandNodeRequest(CamelDictMixin):
    node_id: int = attr.ib()
    filter_labels: List[str] = attr.ib()


@bp.route('/batch', methods=['GET'])
@jsonify_with_class()
def get_batch():
    """ Uses a home-brew query language
    to get a batch of nodes and their
    relationship
    TODO: Document query language
    """
    neo4j = get_neo4j_service_dao()
    data_query = request.args.get('data', '')
    try:
        decoded_query = bytearray.fromhex(data_query).decode()
    except ValueError:
        return SuccessResponse(result='No results found', status_code=200)
    result = neo4j.query_batch(decoded_query)
    return SuccessResponse(result=result, status_code=200)


@bp.route('/expand', methods=['POST'])
@jsonify_with_class(ExpandNodeRequest)
def expand_graph_node(req: ExpandNodeRequest):
    neo4j = get_neo4j_service_dao()
    node = neo4j.expand_graph(req.node_id, req.filter_labels)
    return SuccessResponse(result=node, status_code=200)


@bp.route('/get-reference-table-data', methods=['POST'])
@jsonify_with_class(ReferenceTableDataRequest)
def get_reference_table_data(req: ReferenceTableDataRequest):
    neo4j = get_neo4j_service_dao()
    reference_table_data = neo4j.get_reference_table_data(
        req.node_edge_pairs,
    )
    return SuccessResponse(reference_table_data, status_code=200)


@bp.route('/get-snippets-for-edge', methods=['POST'])
@jsonify_with_class(GetSnippetsForEdgeRequest)
def get_edge_snippet_data(req: GetSnippetsForEdgeRequest):
    neo4j = get_neo4j_service_dao()
    edge_snippets_result = neo4j.get_snippets_for_edge(
        page=req.page,
        limit=req.limit,
        edge=req.edge,
    )
    return SuccessResponse(edge_snippets_result, status_code=200)


@bp.route('/get-snippets-for-cluster', methods=['POST'])
@jsonify_with_class(GetSnippetsForClusterRequest)
def get_cluster_snippet_data(req: GetSnippetsForClusterRequest):
    neo4j = get_neo4j_service_dao()
    cluster_snippets_result = neo4j.get_snippets_for_cluster(
        page=req.page,
        limit=req.limit,
        edges=req.edges,
    )
    return SuccessResponse(cluster_snippets_result, status_code=200)


@bp.route('/get-annotation-legend', methods=['GET'])
@jsonify_with_class()
def get_annotation_legend():
    return SuccessResponse(result=ANNOTATION_STYLES_DICT, status_code=200)
