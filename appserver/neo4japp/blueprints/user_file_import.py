import attr

from flask import Blueprint
from werkzeug.datastructures import FileStorage

from neo4japp.database import db, get_kg_service, get_user_file_import_service
from neo4japp.data_transfer_objects.user_file_import import (
    ImportGenesRequest,
    Neo4jColumnMapping,
    NodePropertiesRequest,
    UploadFileRequest,
)
from neo4japp.models import (
    Worksheet
)
from neo4japp.util import CamelDictMixin, SuccessResponse, jsonify_with_class

bp = Blueprint('user-file-import-api', __name__, url_prefix='/user-file-import')


@bp.route('/get-db-labels', methods=['GET'])
@jsonify_with_class()
def get_db_labels():
    neo4j = get_kg_service()
    labels = neo4j.get_db_labels()
    return SuccessResponse(result=labels, status_code=200)


@bp.route('/get-db-relationship-types', methods=['GET'])
@jsonify_with_class()
def get_db_relationship_types():
    neo4j = get_kg_service()
    relationship_types = neo4j.get_db_relationship_types()
    return SuccessResponse(result=relationship_types, status_code=200)


@bp.route('/get-node-properties', methods=['GET'])
@jsonify_with_class(NodePropertiesRequest)
def get_node_properties(req: NodePropertiesRequest):
    neo4j = get_kg_service()
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
    importer = get_user_file_import_service()
    graph_db_mappings = importer.create_graph_db_mappings(req)

    importer.save_node_to_neo4j(graph_db_mappings)
    importer.save_relationship_to_neo4j(graph_db_mappings)

    return SuccessResponse(result='', status_code=200)


@bp.route('/import-genes', methods=['POST'])
@jsonify_with_class(ImportGenesRequest, has_file=True)
def import_genes(req: ImportGenesRequest):
    import_service = get_user_file_import_service()
    result = import_service.import_worksheet(
        file_name=req.file_name,
        sheet_name=req.sheet_name,
        worksheet=req.file_input,
        worksheet_node_name=req.worksheet_node_name,
        relationships=req.relationships,
    )

    return SuccessResponse(result=result, status_code=200)
