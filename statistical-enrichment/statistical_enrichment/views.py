from functools import partial
from json import dumps
from webargs.flaskparser import use_args

from .app import app
from .auth import login_exempt
from .database import get_or_create_arango_client
from .schemas import EnrichmentSchema
from .services.enrichment.enrichment_visualisation import enrich_go
from .services.rcache import redis_cached


@app.route('/', methods=['GET', 'POST'])
@login_exempt
def enrich():
    raise Exception('No function provided!')


@app.route('/healthz', methods=['GET', 'POST'])
@login_exempt
def healthz():
    return "I am OK!"


@app.route('/enrich-with-go-terms', methods=['POST'])
@use_args(EnrichmentSchema)
def enrich_with_go_terms(args):
    gene_names = args['geneNames']
    organism = args['organism']
    analysis = args['analysis']
    cache_id = '_'.join(['enrich_go', ','.join(gene_names), analysis, str(organism)])
    arango_client = get_or_create_arango_client()
    return redis_cached(
        cache_id,
        partial(enrich_go, arango_client, gene_names, analysis, organism),
        dump=dumps,
    ), dict(mimetype='application/json')
