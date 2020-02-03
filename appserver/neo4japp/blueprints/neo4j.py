import attr

from typing import Dict, List

from flask import Blueprint
from werkzeug.datastructures import FileStorage
from neo4japp.constants import *
from neo4japp.database import get_neo4j_service_dao
from neo4japp.services import Neo4JService, Neo4jColumnMapping
from neo4japp.util import CamelDictMixin, SuccessResponse, jsonify_with_class

bp = Blueprint('neo4j-api', __name__, url_prefix='/neo4j')

@attr.s(frozen=True)
class SearchResult(CamelDictMixin):
    id: str = attr.ib()
    score: float = attr.ib()
    type: str = attr.ib()
    labels: [str] = attr.ib()
    data_source: str = attr.ib()
    all_text: str = attr.ib()
    common_name: str = attr.ib()
    synonyms: str = attr.ib()
    alt_ids: [str] = attr.ib()
    conjugate: str = attr.ib()
    organism: object = attr.ib()  # TODO: Make more specific

    def get_db_labels(self):
        return [l for l in self.labels
                if l not in set(TYPE_COMPOUND, TYPE_GENE, TYPE_PROTEIN, TYPE_PATHWAY)]

    def is_gene(self):
        return TYPE_GENE == self.type or TYPE_GENE in self.labels

    def is_protein(self):
        return TYPE_PROTEIN == self.type or TYPE_PROTEIN in self.labels

    def is_compound(self):
        return TYPE_COMPOUND == self.type or TYPE_COMPOUND in self.labels

    def is_chemical(self):
        return TYPE_CHEMICAL == self.type or DB_CHEBI in self.labels

    def is_pathway(self):
        return TYPE_PATHWAY == self.type or TYPE_PATHWAY in self.labels

    def node_label(self):
        return ':' + ':'.join(self.labels)

    def get_node_label(self, node_type: str, db_names: [str]):
        labels = []
        if node_type == TYPE_CHEMICAL:
            labels = labels + db_names
        else:
            labels.append(node_type)
            labels += db_names
        return ':'.join(labels)

    def get_graph_layout(self):
        if self.is_compound():
            # TODO: See what the equivalent is
            # for vis.js
            # {'layout': 'klay', 'rank_dir': 'TB'}
            pass
        else:
            # TODO: See what the equivalent is
            # for vis.js
            # {'layout': 'dagre', 'rank_dir': 'TB'}
            pass


@attr.s(frozen=True)
class GraphRequest(SearchResult):
    org_ids: str = attr.ib()

@attr.s(frozen=True)
class ReactionRequest(CamelDictMixin):
    biocyc_id: int = attr.ib()

@attr.s(frozen=True)
class ExpandNodeRequest(CamelDictMixin):
    node_id: int = attr.ib()

@attr.s(frozen=True)
class UploadFileRequest(CamelDictMixin):
    file_input: FileStorage = attr.ib()

@attr.s(frozen=True)
class NodePropertiesRequest(CamelDictMixin):
    node_label: str = attr.ib()


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

@bp.route('/regulatory', methods=['POST'])
@jsonify_with_class(GraphRequest)
def load_regulatory_graph(req: GraphRequest):
    neo4j = get_neo4j_service_dao()
    if req.is_gene():
        result = neo4j.load_gpr_graph(req)
        return SuccessResponse(result=result, status_code=200)
    return SuccessResponse(result='', status_code=200)

@bp.route('/expand', methods=['POST'])
@jsonify_with_class(ExpandNodeRequest)
def expand_graph_node(req: ExpandNodeRequest):
    neo4j = get_neo4j_service_dao()
    node = neo4j.expand_graph(req.node_id)
    return SuccessResponse(result=node, status_code=200)

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
