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


@bp.route('/match-ncbi-nodes', methods=['POST'])
@auth.login_required
def match_ncbi_nodes():
    # TODO: Validate incoming data using webargs + Marshmallow and move to class-based view
    data = request.get_json()
    geneNames = data.get('geneNames')
    organism = data.get('organism')
    if organism is not None and geneNames is not None:
        enrichment_table = get_enrichment_table_service()
        nodes = enrichment_table.match_ncbi_genes(geneNames, organism)
    else:
        nodes = []
    return jsonify({'result': nodes}), 200
