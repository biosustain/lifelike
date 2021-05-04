from statistical_enrichment import app, EnrichmentSchema

from functools import partial

from neo4japp.blueprints.auth import auth
from neo4japp.database import get_enrichment_visualisation_service
from neo4japp.services.rcache import redis_cached
from webargs.flaskparser import use_args

@app.route('/enrich-with-go-terms', methods=['POST'])
@auth.login_required
@use_args(EnrichmentSchema)
def enrich_go(args):
    gene_names = args['geneNames']
    organism = args['organism']
    analysis = args['analysis']
    cache_id = '_'.join(['enrich_go', ','.join(gene_names), analysis, str(organism)])
    enrichment_visualisation = get_enrichment_visualisation_service()
    return redis_cached(
            cache_id, partial(enrichment_visualisation.enrich_go, gene_names, analysis, organism)
    ), dict(mimetype='application/json')
