from flask import (
    Blueprint,
    current_app,
    request,
    jsonify,
    g
)

from sqlalchemy.orm.exc import NoResultFound

from neo4japp.blueprints.auth import auth
from neo4japp.database import get_enrichment_visualisation_service
from neo4japp.models import Worksheet

from neo4japp.exceptions import RecordNotFoundException
from neo4japp.utils.logger import UserEventLog

bp = Blueprint('enrichment-visualisation-api', __name__, url_prefix='/enrichment-visualisation')

@bp.route('/enrich-with-go-terms', methods=['POST'])
@auth.login_required
def enrich_go():
    data = request.get_json()
    geneNames = data['geneNames']
    organism = data['organism']
    enrichment_visualisation = get_enrichment_visualisation_service()
    nodes = enrichment_visualisation.enrich_go(geneNames)

    return jsonify({'result': nodes}), 200
