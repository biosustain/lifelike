import numpy as np
from flask import Blueprint, request, jsonify
from pandas import DataFrame

from neo4japp.constants import KGDomain
from neo4japp.database import get_kg_service

bp = Blueprint("kg-api", __name__, url_prefix="/knowledge-graph")


@bp.route("/get-ncbi-nodes/enrichment-domains", methods=["POST"])
def get_ncbi_enrichment_domains():
    """Find all domains matched to given node id, then return dictionary with all domains as
    result. All domains should have matching indices e.g. regulon[1] should be data from
    matching same node as uniprot[1].
    """
    # TODO: Validate incoming data using webargs + Marshmallow
    data = request.get_json()
    node_ids = data.get("nodeIds")
    tax_id = data.get("taxID")
    domains = data.get("domains")

    if node_ids is not None and tax_id is not None:
        kg = get_kg_service()
        domain_nodes = {
            domain.lower(): kg.get_genes(KGDomain(domain), node_ids, tax_id)
            for domain in domains
        }
        df = DataFrame(domain_nodes).replace({np.nan: None}).transpose()
        # Redundant but just following old implementation
        nodes = df.append(df.columns.to_series(name="node_id")).to_dict()
    else:
        nodes = {}

    return jsonify({"result": nodes}), 200


@bp.route("/shortest-path-query/<int:query_id>", methods=["GET"])
def get_shortest_path_query_result(query_id):
    kg = get_kg_service()
    result = kg.get_shortest_path_data(query_id)
    return jsonify({"result": result}), 200


@bp.route("/shortest-path-query-list", methods=["GET"])
def get_shortest_path_query_list():
    kg = get_kg_service()
    result = kg.get_shortest_path_query_list()
    return jsonify({"result": result}), 200
