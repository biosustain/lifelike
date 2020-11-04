import attr

from flask import Blueprint, request, jsonify, make_response

from typing import List
from sqlalchemy.orm.exc import NoResultFound

from neo4japp.blueprints.auth import auth
from neo4japp.constants import ANNOTATION_STYLES_DICT
from neo4japp.database import get_enrichment_table_service, db
from neo4japp.models import (
    Worksheet,
    FileContent
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

bp = Blueprint('enrichment-table-api', __name__, url_prefix='/enrichment-table')


@bp.route('/get-neo4j-worksheet/<string:worksheet_id>', methods=['GET'])
@auth.login_required
def get_neo4j_worksheet(worksheet_id: str):
    try:
        worksheets = Worksheet.query.filter(Worksheet.id == worksheet_id).one()
    except NoResultFound:
        raise RecordNotFoundException('Worksheet not found.')

    return jsonify({'result': worksheets.to_dict()}), 200


@bp.route('/match-ncbi-nodes', methods=['POST'])
@auth.login_required
def match_ncbi_nodes():
    data = request.get_json()
    geneNames = data['geneNames']
    organism = data['organism']
    enrichment_table = get_enrichment_table_service()
    nodes = enrichment_table.match_ncbi_genes(geneNames, organism)

    return jsonify({'result': nodes}), 200
