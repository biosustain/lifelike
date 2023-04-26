from arango.client import ArangoClient
from typing import Any, Dict

from neo4japp.services.arangodb import execute_arango_query, get_db

from .utils.graph_queries import get_organisms_from_gene_ids_query


def get_organisms_from_gene_ids(arango_client: ArangoClient, gene_ids: Dict[Any, int]):
    return execute_arango_query(
        db=get_db(arango_client),
        query=get_organisms_from_gene_ids_query(),
        gene_ids=list(gene_ids.keys())
    )
