from flask import (
    Blueprint,
    request,
    jsonify
    )

from neo4japp.blueprints.auth import auth
from neo4japp.database import get_enrichment_visualisation_service

bp = Blueprint('enrichment-visualisation-api', __name__, url_prefix='/enrichment-visualisation')


@bp.route('/enrich-with-go-terms', methods=['POST'])
@auth.login_required
def enrich_go():
    data = request.get_json()
    geneNames = data['geneNames']
    organism = data['organism']
    analysis = data['analysis']
    enrichment_visualisation = get_enrichment_visualisation_service()
    nodes = enrichment_visualisation.enrich_go(geneNames, analysis)

    return jsonify({ 'result': nodes }), 200
