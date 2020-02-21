import attr

from flask import Blueprint
from werkzeug.datastructures import FileStorage

from neo4japp.constants import *
from neo4japp.database import get_neo4j_service_dao, get_user_file_import_service
from neo4japp.services import Neo4JService, Neo4jColumnMapping
from neo4japp.util import CamelDictMixin, SuccessResponse, jsonify_with_class

bp = Blueprint('user-file-import-api', __name__, url_prefix='/user-file-import')


@attr.s(frozen=True)
class UploadFileRequest(CamelDictMixin):
    file_input: FileStorage = attr.ib()

@attr.s(frozen=True)
class NodePropertiesRequest(CamelDictMixin):
    node_label: str = attr.ib()


@bp.route('/get-db-labels', methods=['GET'])
@jsonify_with_class()
def get_db_labels():
    neo4j = get_neo4j_service_dao()
    labels = neo4j.get_db_labels()
    return SuccessResponse(result=labels, status_code=200)


@bp.route('/get-db-relationship-types', methods=['GET'])
@jsonify_with_class()
def get_db_relationship_types():
    neo4j = get_neo4j_service_dao()
    relationship_types = neo4j.get_db_relationship_types()
    return SuccessResponse(result=relationship_types, status_code=200)


@bp.route('/get-node-properties', methods=['GET'])
@jsonify_with_class(NodePropertiesRequest)
def get_node_properties(req: NodePropertiesRequest):
    neo4j = get_neo4j_service_dao()
    props = neo4j.get_node_properties(req.node_label)
    return SuccessResponse(result=props, status_code=200)


@bp.route('/upload-file', methods=['POST'])
@jsonify_with_class(UploadFileRequest, has_file=True)
def upload_neo4j_file(req: UploadFileRequest):
    importer = get_user_file_import_service()
    workbook = importer.parse_file(req.file_input)
    worksheet_names_and_cols = importer.get_workbook_sheet_names_and_columns(
        filename=req.file_input.filename,
        workbook=workbook,
    )
    return SuccessResponse(result=worksheet_names_and_cols, status_code=200)


@bp.route('/upload-node-mapping', methods=['POST'])
@jsonify_with_class(Neo4jColumnMapping)
def upload_node_mapping(req: Neo4jColumnMapping):
    neo4j = get_neo4j_service_dao()
    importer = get_user_file_import_service()
    node_mappings = importer.create_node_mapping(req)
    neo4j.save_node_to_neo4j(node_mappings)

    return SuccessResponse(result='', status_code=200)
