import attr

from typing import Dict, List

from flask import Blueprint
from werkzeug.datastructures import FileStorage

from neo4japp.database import get_neo4j_service_dao
from neo4japp.services import Neo4JService, Neo4jColumnMapping
from neo4japp.util import CamelDictMixin, SuccessResponse, jsonify_with_class

bp = Blueprint('neo4j-api', __name__, url_prefix='/neo4j')


@attr.s(frozen=True)
class UploadFileRequest(CamelDictMixin):
    file_input: FileStorage = attr.ib()


@bp.route('/', methods=['POST'])
def run_cypher():
    dao = get_neo4j_service_dao()
    query = request.get_json()
    # TODO: Sanitize the queries
    result = dao.execute_cypher(query['query'])
    return jsonify({'result': result}), 200


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


@bp.route('/upload-mapping-file', methods=['POST'])
@jsonify_with_class(Neo4jColumnMapping)
def upload_neo4j_mapping_file(req: Neo4jColumnMapping):
    neo4j = get_neo4j_service_dao()
    neo4j.export_to_neo4j(req)

    return SuccessResponse(result='', status_code=200)


