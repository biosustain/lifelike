import json
from functools import partial

from flask import (
    Blueprint,
    request, jsonify
)
from neo4japp.blueprints.auth import auth
from neo4japp.database import get_enrichment_visualisation_service
from neo4japp.services.redis import redis_cached

bp = Blueprint('enrichment-visualisation-api', __name__, url_prefix='/enrichment-visualisation')


@bp.route('/enrich-with-go-terms', methods=['POST'])
@auth.login_required
def enrich_go():
    data = request.get_json()
    gene_names = data['geneNames']
    organism = data['organism']
    analysis = data['analysis']
    cache_id = '_'.join(['enrich_go', ','.join(gene_names), analysis, organism])
    enrichment_visualisation = get_enrichment_visualisation_service()
    nodes = redis_cached(
            cache_id, partial(enrichment_visualisation.enrich_go, gene_names, analysis, organism)
    )
    return '{ "result": ' + nodes + '}', 200


@bp.route('/get_GO_significance', methods=['POST'])
@auth.login_required
def go_significance():
    data = request.get_json()
    gene_names = data['geneNames']
    organism = data['organism']
    cache_id = '_'.join(['go_significance', ','.join(gene_names), organism])
    enrichment_visualisation = get_enrichment_visualisation_service()
    nodes = redis_cached(
            cache_id, partial(enrichment_visualisation.get_GO_significance, gene_names, organism),
            load=json.loads, dump=json.dumps
    )

    return jsonify({"result": nodes}), 200
