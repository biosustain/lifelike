from flask import (
    Blueprint,
    current_app,
    request,
    jsonify,
    g
)

from sqlalchemy.orm.exc import NoResultFound

from neo4japp.blueprints.auth import auth
from neo4japp.database import get_enrichment_table_service
from neo4japp.models import Worksheet

from neo4japp.exceptions import RecordNotFoundException
from neo4japp.utils.logger import UserEventLog

bp = Blueprint('enrichment-table-api', __name__, url_prefix='/enrichment-table')


# Outdated.
@bp.route('/get-neo4j-worksheet/<string:worksheet_id>', methods=['GET'])
@auth.login_required
def get_neo4j_worksheet(worksheet_id: str):
    try:
        worksheets = Worksheet.query.filter(Worksheet.id == worksheet_id).one()
        current_app.logger.info(
            f'Worksheet ID: {worksheet_id}',
            extra=UserEventLog(
                username=g.current_user.username, event_type='get enrichment table').to_dict()
        )
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
