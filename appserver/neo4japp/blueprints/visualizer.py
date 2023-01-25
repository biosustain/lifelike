from flask import Blueprint, jsonify
from flask.views import MethodView
from flask_apispec import use_kwargs

from neo4japp.constants import ANNOTATION_STYLES_DICT
from neo4japp.database import get_or_create_arango_client
from neo4japp.data_transfer_objects.visualization import (
    ExpandNodeRequest,
    GetSnippetsForEdgeRequest,
    GetSnippetsForClusterRequest,
    ReferenceTableDataRequest,
)
from neo4japp.exceptions import InvalidArgument
from neo4japp.request_schemas.visualizer import (
    GetSnippetsForNodePairRequest,
    AssociatedTypeSnippetCountRequest,
)
from neo4japp.services.visualizer import (
    expand_node_as_clusters,
    get_associated_type_snippet_count,
    get_document_for_visualizer,
    get_reference_table_data,
    get_snippets_for_edge,
    get_snippets_for_cluster,
    get_snippets_for_node_pair

)
from neo4japp.util import SuccessResponse, jsonify_with_class

bp = Blueprint('visualizer-api', __name__, url_prefix='/visualizer')


@bp.route('/get-annotation-legend', methods=['GET'])
@jsonify_with_class()
def get_annotation_legend():
    return SuccessResponse(result=ANNOTATION_STYLES_DICT, status_code=200)


@bp.route('/expand', methods=['POST'])
@jsonify_with_class(ExpandNodeRequest)
def expand_graph_node_as_clusters(req: ExpandNodeRequest):
    arango_client = get_or_create_arango_client()
    node = expand_node_as_clusters(arango_client, req.node_id, req.filter_labels)
    return SuccessResponse(result=node, status_code=200)


@bp.route('/get-reference-table', methods=['POST'])
@jsonify_with_class(ReferenceTableDataRequest)
def get_ref_table(req: ReferenceTableDataRequest):
    arango_client = get_or_create_arango_client()
    reference_table_data = get_reference_table_data(
        arango_client,
        [pair.to_dict() for pair in req.node_edge_pairs]
    )
    return SuccessResponse(reference_table_data, status_code=200)


@bp.route('/get-snippets-for-edge', methods=['POST'])
@jsonify_with_class(GetSnippetsForEdgeRequest)
def get_edge_snippet_data(req: GetSnippetsForEdgeRequest):
    # TODO: In the future would be better to refactor this request to use Marshmallow and handle
    # the validation in the schema, but in the interest of time favoring this approach for now.
    if not (0 <= req.limit and req.limit <= 1000):
        raise InvalidArgument(
            title='Failed to Get Edge Snippets',
            message='Query limit is out of bounds, the limit is 0 <= limit <= 1000.',
            code=400
        )

    arango_client = get_or_create_arango_client()
    result = get_snippets_for_edge(arango_client, req.edge, req.page, req.limit)
    return SuccessResponse(result, status_code=200)


@bp.route('/get-snippets-for-cluster', methods=['POST'])
@jsonify_with_class(GetSnippetsForClusterRequest)
def get_cluster_snippet_data(req: GetSnippetsForClusterRequest):
    # TODO: In the future would be better to refactor this request to use Marshmallow and handle
    # the validation in the schema, but in the interest of time favoring this approach for now.
    if not (0 <= req.limit and req.limit <= 1000):
        raise InvalidArgument(
            title='Failed to Get Cluster Snippets',
            message='Query limit is out of bounds, the limit is 0 <= limit <= 1000.',
            code=400
        )

    arango_client = get_or_create_arango_client()
    result = get_snippets_for_cluster(arango_client, req.edges, req.page, req.limit)
    return SuccessResponse(result, status_code=200)


@bp.route('/get-associated-type-snippet-count', methods=['POST'])
@use_kwargs(AssociatedTypeSnippetCountRequest)
def get_assoc_type_snippet_count(source_node, associated_nodes):
    arango_client = get_or_create_arango_client()
    result = get_associated_type_snippet_count(arango_client, source_node, associated_nodes)
    return jsonify({
        'result': result.to_dict(),
    })


@bp.route('/get-snippets-for-node-pair', methods=['POST'])
@use_kwargs(GetSnippetsForNodePairRequest)
def get_snippets_for_pair(node_1_id, node_2_id, page, limit):
    arango_client = get_or_create_arango_client()
    result = get_snippets_for_node_pair(arango_client, node_1_id, node_2_id, page, limit)

    return jsonify({
        'result': result.to_dict()
    })


class GetDocumentView(MethodView):
    def get(self, collection: str, key: str):
        arango_client = get_or_create_arango_client()
        doc_id = f'{collection}/{key}'
        result = get_document_for_visualizer(arango_client, doc_id)
        return jsonify({
            'nodes': [result],
            'edges': []
        })


bp.add_url_rule('/document/<string:collection>/<string:key>',
                view_func=GetDocumentView.as_view('fetch_document'))
