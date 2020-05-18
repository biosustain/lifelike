import attr

from flask import Blueprint, request

from typing import List

from neo4japp.blueprints import GraphRequest
from neo4japp.constants import *
from neo4japp.database import get_neo4j_service_dao

from neo4japp.data_transfer_objects.visualization import (
    GetGraphDataForClusterRequest,
    GetSnippetCountsFromEdgesRequest,
    GetDataForClusterRequest,
    GetSnippetsFromDuplicateEdgeRequest,
    GetSnippetsFromEdgeRequest,
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
    limit: int = attr.ib()


@bp.route('/', methods=['POST'])
@jsonify_with_class(GraphRequest)
def load_gpr_graph(req: GraphRequest):
    neo4j = get_neo4j_service_dao()
    graph = neo4j.get_graph(req)
    return SuccessResponse(result=graph, status_code=200)


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

# TODO: Is this in use by anything?
@bp.route('/regulatory', methods=['POST'])
@jsonify_with_class(GraphRequest)
def load_regulatory_graph(req: GraphRequest):
    neo4j = get_neo4j_service_dao()
    if req.is_gene():
        result = neo4j.load_gpr_graph(req)
        return SuccessResponse(result=result, status_code=200)
    return SuccessResponse(result='', status_code=200)

# TODO: Should make sure that the results of expansion are balanced.
# For example, if a node has 1000 Chemical neighbors, but only 1 Gene
@bp.route('/expand', methods=['POST'])
@jsonify_with_class(ExpandNodeRequest)
def expand_graph_node(req: ExpandNodeRequest):
    neo4j = get_neo4j_service_dao()
    node = neo4j.expand_graph(req.node_id, req.filter_labels, req.limit)
    return SuccessResponse(result=node, status_code=200)


@bp.route('/get-snippets-from-edge', methods=['POST'])
@jsonify_with_class(GetSnippetsFromEdgeRequest)
def get_snippets_from_edge(req: GetSnippetsFromEdgeRequest):
    neo4j = get_neo4j_service_dao()
    snippets_result = neo4j.get_snippets_from_edge(
        req.edge,
    )
    return SuccessResponse(result=snippets_result, status_code=200)


@bp.route('/get-snippets-from-duplicate-edge', methods=['POST'])
@jsonify_with_class(GetSnippetsFromDuplicateEdgeRequest)
def get_snippets_from_duplicate_edge(req: GetSnippetsFromDuplicateEdgeRequest):
    neo4j = get_neo4j_service_dao()
    snippets_result = neo4j.get_snippets_from_duplicate_edge(
        req.edge,
    )
    return SuccessResponse(result=snippets_result, status_code=200)

# Currently unused
# @bp.route('/get-snippet-counts-from-edges', methods=['POST'])
# @jsonify_with_class(GetSnippetCountsFromEdgesRequest)
# def get_snippet_count_for_edges(req: GetSnippetCountsFromEdgesRequest):
#     neo4j = get_neo4j_service_dao()
#     edge_snippet_count_result = neo4j.get_snippet_counts_from_edges(
#         req.edges,
#     )
#     return SuccessResponse(edge_snippet_count_result, status_code=200)


@bp.route('/get-reference-table-data', methods=['POST'])
@jsonify_with_class(ReferenceTableDataRequest)
def get_reference_table_data(req: ReferenceTableDataRequest):
    neo4j = get_neo4j_service_dao()
    reference_table_data = neo4j.get_reference_table_data(
        req.node_edge_pairs,
    )
    return SuccessResponse(reference_table_data, status_code=200)


@bp.route('/get-cluster-graph-data', methods=['POST'])
@jsonify_with_class(GetGraphDataForClusterRequest)
def get_cluster_graph_data(req: GetGraphDataForClusterRequest):
    neo4j = get_neo4j_service_dao()
    cluster_graph_data_result = neo4j.get_cluster_graph_data(
        req.clustered_nodes,
    )
    return SuccessResponse(cluster_graph_data_result, status_code=200)


@bp.route('/get-cluster-data', methods=['POST'])
@jsonify_with_class(GetDataForClusterRequest)
def get_cluster_snippet_data(req: GetDataForClusterRequest):
    neo4j = get_neo4j_service_dao()
    cluster_data_result = neo4j.get_cluster_data(
        req.clustered_nodes,
    )
    return SuccessResponse(cluster_data_result, status_code=200)


# TODO: Is this in use by anything?
@bp.route('/reaction', methods=['POST'])
@jsonify_with_class(ReactionRequest)
def load_reaction_graph(req: ReactionRequest):
    neo4j = get_neo4j_service_dao()
    result = neo4j.load_reaction_graph(req.biocyc_id)
    return SuccessResponse(result=result, status_code=200)
