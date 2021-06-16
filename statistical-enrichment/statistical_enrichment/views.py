from . import app

from functools import partial

from .services.rcache import redis_cached
from webargs.flaskparser import use_args
from .schemas import EnrichmentSchema
from .services import get_enrichment_visualisation_service

@app.route('/', methods=['GET','POST'])
def enrich():
    raise Exception('No function provided!')

@app.route('/healthz', methods=['GET','POST'])
def healthz():
    return "I am OK!"

@app.route('/enrich-with-go-terms', methods=['POST'])
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
