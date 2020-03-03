import attr

from typing import Dict, List

from flask import Blueprint
from werkzeug.datastructures import FileStorage
from neo4japp.blueprints import GraphRequest
from neo4japp.constants import *
from neo4japp.database import get_neo4j_service_dao
from neo4japp.data_transfer_objects.visualization import (
    GetGraphDataForClusterRequest,
    GetSnippetCountsFromEdgesRequest,
    GetSnippetsFromDuplicateEdgeRequest,
    GetSnippetsFromEdgeRequest,
    ReferenceTableDataRequest,
)
from neo4japp.services import Neo4JService, Neo4jColumnMapping
from neo4japp.util import CamelDictMixin, SuccessResponse, jsonify_with_class

bp = Blueprint('neo4j-api', __name__, url_prefix='/neo4j')


@attr.s(frozen=True)
class ReactionRequest(CamelDictMixin):
    biocyc_id: int = attr.ib()

@attr.s(frozen=True)
class ExpandNodeRequest(CamelDictMixin):
    node_id: int = attr.ib()
    limit: int = attr.ib()

@attr.s(frozen=True)
class UploadFileRequest(CamelDictMixin):
    file_input: FileStorage = attr.ib()

@attr.s(frozen=True)
class NodePropertiesRequest(CamelDictMixin):
    node_label: str = attr.ib()

@attr.s(frozen=True)
class SearchRequest(CamelDictMixin):
    query: str = attr.ib()


@bp.route('/', methods=['POST'])
@jsonify_with_class(GraphRequest)
def load_gpr_graph(req: GraphRequest):
    neo4j = get_neo4j_service_dao()
    graph = neo4j.get_graph(req)
    return SuccessResponse(result=graph, status_code=200)

@bp.route('/organisms', methods=['GET'])
@jsonify_with_class()
def get_organisms():
    neo4j = get_neo4j_service_dao()
    organisms = neo4j.get_organisms()
    return SuccessResponse(result=organisms, status_code=200)

# NOTE: This is just a temp endpoint, may remove in the future
@bp.route('/diseases', methods=['GET'])
@jsonify_with_class()
def get_some_diseases():
    neo4j = get_neo4j_service_dao()
    diseases = neo4j.get_some_diseases()
    return SuccessResponse(result=diseases, status_code=200)

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
    node = neo4j.expand_graph(req.node_id, req.limit)
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

@bp.route('/get-snippet-counts-from-edges', methods=['POST'])
@jsonify_with_class(GetSnippetCountsFromEdgesRequest)
def get_snippet_count_for_edges(req: GetSnippetCountsFromEdgesRequest):
    neo4j = get_neo4j_service_dao()
    edge_snippet_count_result = neo4j.get_snippet_counts_from_edges(
        req.edges,
    )
    return SuccessResponse(edge_snippet_count_result, status_code=200)

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

@bp.route('/reaction', methods=['POST'])
@jsonify_with_class(ReactionRequest)
def load_reaction_graph(req: ReactionRequest):
    neo4j = get_neo4j_service_dao()
    result = neo4j.load_reaction_graph(req.biocyc_id)
    return SuccessResponse(result=result, status_code=200)


@bp.route('/get-db-labels', methods=['GET'])
@jsonify_with_class()
def get_db_labels():
    neo4j = get_neo4j_service_dao()
    labels = neo4j.get_db_labels()
    return SuccessResponse(result=labels, status_code=200)


@bp.route('/get-node-properties', methods=['GET'])
@jsonify_with_class(NodePropertiesRequest)
def get_node_properties(req: NodePropertiesRequest):
    neo4j = get_neo4j_service_dao()
    props = neo4j.get_node_properties(req.node_label)
    return SuccessResponse(result=props, status_code=200)


@bp.route('/upload-file', methods=['POST'])
@jsonify_with_class(UploadFileRequest, has_file=True)
def upload_neo4j_file(req: UploadFileRequest):
    neo4j = get_neo4j_service_dao()
    workbook = neo4j.parse_file(req.file_input)
    worksheet_names_and_cols = neo4j.get_workbook_sheet_names_and_columns(
        filename=req.file_input.filename,
        workbook=workbook,
    )
    return SuccessResponse(result=worksheet_names_and_cols, status_code=200)


@bp.route('/upload-node-mapping', methods=['POST'])
@jsonify_with_class(Neo4jColumnMapping)
def upload_node_mapping(req: Neo4jColumnMapping):
    neo4j = get_neo4j_service_dao()
    neo4j.save_node_to_neo4j(req)

    return SuccessResponse(result='', status_code=200)


@bp.route('/upload-relationship-mapping', methods=['POST'])
@jsonify_with_class(Neo4jColumnMapping)
def upload_relationship_mapping(req: Neo4jColumnMapping):
    neo4j = get_neo4j_service_dao()
    neo4j.save_relationship_to_neo4j(req)

    return SuccessResponse(result='', status_code=200)


@bp.route('/search', methods=['POST'])
@jsonify_with_class(SearchRequest)
def prefix_search(req: SearchRequest):
    neo4j = get_neo4j_service_dao()
    results = neo4j.prefix_search(req.query)
    return SuccessResponse(result=results, status_code=200)
