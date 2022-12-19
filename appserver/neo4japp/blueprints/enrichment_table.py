from flask import Blueprint, request, jsonify
import numpy as np
from pandas import DataFrame

from neo4japp.constants import KGDomain
from neo4japp.database import get_or_create_arango_client
from neo4japp.services.enrichment.enrichment_table import get_genes, match_ncbi_genes


bp = Blueprint('enrichment-table-api', __name__, url_prefix='/enrichment-table')


@bp.route('/match-ncbi-nodes', methods=['POST'])
def match_ncbi_nodes():
    # TODO: Validate incoming data using webargs + Marshmallow and move to class-based view
    data = request.get_json()
    gene_names = data.get('geneNames')
    organism = data.get('organism')
    nodes = []

    if organism is not None and gene_names is not None:
        arango_client = get_or_create_arango_client()
        # list(dict...) is to drop duplicates, but want to keep order
        nodes = match_ncbi_genes(arango_client, list(dict.fromkeys(gene_names)), organism)

    return jsonify({'result': nodes}), 200


@bp.route('/get-ncbi-nodes/enrichment-domains', methods=['POST'])
def get_ncbi_enrichment_domains():
    """ Find all domains matched to given node id, then return dictionary with all domains as
        result. All domains should have matching indices e.g. regulon[1] should be data from
        matching same node as uniprot[1].
    """
    # TODO: Validate incoming data using webargs + Marshmallow
    data = request.get_json()
    doc_ids = data.get('docIds')
    tax_id = data.get('taxID')
    domains = data.get('domains')

    if doc_ids is not None and tax_id is not None:
        arango_client = get_or_create_arango_client()
        domain_nodes = {
            domain.lower(): get_genes(arango_client, KGDomain(domain), doc_ids, tax_id) for domain in domains
        }
        df = DataFrame(domain_nodes).replace({np.nan: None}).transpose()
        # Redundant but just following old implementation
        nodes = df.append(df.columns.to_series(name='doc_id')).to_dict()
    else:
        nodes = {}

    return jsonify({'result': nodes}), 200