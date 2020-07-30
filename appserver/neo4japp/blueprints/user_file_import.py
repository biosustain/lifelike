import attr
import hashlib

from flask import Blueprint
from sqlalchemy.orm.exc import NoResultFound
from werkzeug.datastructures import FileStorage

from neo4japp.database import db, get_neo4j_service_dao, get_user_file_import_service
from neo4japp.data_transfer_objects.user_file_import import (
    ImportGenesRequest,
    Neo4jColumnMapping,
    NodePropertiesRequest,
    UploadFileRequest,
)
from neo4japp.exceptions import (
    DatabaseError,
    FileUploadError,
)
from neo4japp.models import (
    FileContent,
    Worksheet
)
from neo4japp.util import CamelDictMixin, SuccessResponse, jsonify_with_class

bp = Blueprint('user-file-import-api', __name__, url_prefix='/user-file-import')


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
    importer = get_user_file_import_service()
    graph_db_mappings = importer.create_graph_db_mappings(req)

    importer.save_node_to_neo4j(graph_db_mappings)
    importer.save_relationship_to_neo4j(graph_db_mappings)

    return SuccessResponse(result='', status_code=200)


# TODO: Needs error handling
@bp.route('/import-genes', methods=['POST'])
@jsonify_with_class(ImportGenesRequest, has_file=True)
def import_genes(req: ImportGenesRequest):
    import_service = get_user_file_import_service()
    worksheet_node_id = import_service.import_gene_relationships(
        file_name=req.file_name,
        sheet_name=req.sheet_name,
        worksheet_node_name=req.worksheet_node_name,
        relationships=req.relationships,
    )

    try:
        worksheet = req.file_input
        worksheet_content = worksheet.read()
        worksheet.stream.seek(0)

        checksum_sha256 = hashlib.sha256(worksheet_content).digest()
    except Exception:
        # If _any_ error is thrown after importing nodes, we should discard what was imported
        # to make sure the KG and Postgres don't get out of sync.
        # TODO: import_service.detach_and_delete_worksheet(worksheet_node_id)
        raise FileUploadError(
            'Nodes were successfully imported, but an unexpected error occurred ' +
            'while parsing the uploaded worksheet. The imported nodes have been discarded.' +
            'Please try importing again.'
        )

    try:
        # TODO: Really should add this chunk of code to the import_service, but how to write the
        # UserFileImportService so that it can use both GraphBaseDao and RDBMSBaseDao...?
        try:
            # First look for an existing copy of this file
            file_content = db.session.query(
                FileContent.id
            ).filter(
                FileContent.checksum_sha256 == checksum_sha256
            ).one()
        except NoResultFound:
            # Otherwise, let's add the file content to the database
            file_content = FileContent(
                raw_file=worksheet_content,
                checksum_sha256=checksum_sha256
            )
            db.session.add(file_content)
            db.session.flush()

        new_worksheet = Worksheet(
            filename=req.file_name,
            sheetname=req.sheet_name,
            neo4j_node_id=worksheet_node_id,
            content_id=file_content.id
        )
        db.session.add(new_worksheet)
        db.session.commit()
    except Exception:
        # If _any_ error is thrown after importing nodes, we should discard what was imported
        # to make sure the KG and Postgres don't get out of sync.
        # TODO: import_service.detach_and_delete_worksheet(worksheet_node_id)
        raise DatabaseError(
            'Nodes were successfully imported, but an unexpected error occurred ' +
            'while saving your worksheet to the database. The imported nodes have been discarded.' +
            'Please try importing again.'
        )

    return SuccessResponse(result=[], status_code=200)
