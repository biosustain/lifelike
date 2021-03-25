import json
import logging
from functools import partial
from typing import List
import pandas as pd
from neo4japp.exceptions import ServerException
from neo4japp.services import KgService
from neo4japp.services.enrichment.enrich_methods import fisher
from neo4japp.services.redis import redis_cached, redis_server

# Excessive logging noticeably slows down execution
logging.getLogger("py2neo.client.bolt").setLevel(logging.INFO)

from neo4japp.database import connect_to_neo4j

graph = connect_to_neo4j()


def fetchOrganismGO(organism_id):
    return graph.run(
            """
            MATCH (:Taxonomy {id:$id})-
                   [:HAS_TAXONOMY]-(n:Gene)-[:GO_LINK]-(g:db_GO)
            WITH n, g, labels(g) AS go_labels
            RETURN
                n.id AS geneId, n.name AS geneName, g.id AS goId, g.name AS goTerm,
                [lbl IN go_labels WHERE lbl<> 'db_GO'] AS goLabel
            """,
            id=organism_id
    ).data()


for organism_id in graph.run(
        """
        MATCH (t:Taxonomy)
        RETURN t.id
        """
).data():
    redis_cached(f'GO_for_{organism_id}', partial(fetchOrganismGO, organism_id))


class EnrichmentVisualisationService(KgService):

    def __init__(self, graph, session):
        super().__init__(graph=graph, session=session)

    def enrich_go(self, gene_names: List[str], analysis, organism):
        if analysis == 'fisher':
            GO_terms = redis_server.get(f'GO_for_{organism_id}')
            if GO_terms:
                df = pd.Dataframe(GO_terms)
                GO = df[df['geneName'].in1d(gene_names)]
                fisher(gene_names, GO, len(GO_terms))
            else:
            return fisher(gene_names, self.get_go_terms(organism))
        raise NotImplementedError

    def query_go_term(self, organism_id):
        r = self.graph.run(
                """
                MATCH (:Taxonomy {id:$id})-
                       [:HAS_TAXONOMY]-(n:Gene)-[:GO_LINK]-(g:db_GO)
                WITH n, g, labels(g) AS go_labels
                RETURN
                    n.id AS geneId, n.name AS geneName, g.id AS goId, g.name AS goTerm,
                    [lbl IN go_labels WHERE lbl<> 'db_GO'] AS goLabel
                """,
                id=organism_id
        ).data()
        # raise if empty - should never happen so fail fast
        if not r:
            raise ServerException(
                    message=f'Could not find related GO terms for organism id: {organism_id}')
        return r

    def get_go_terms(self, organism):
        cache_id = f"get_go_terms_{organism}"
        return redis_cached(
                cache_id,
                partial(self.query_go_term, organism.id),
                load=json.loads,
                dump=json.dumps
        )

    def get_go_significance(self, gene_names, organism):
        return self.graph.run(
                """
                match (:Taxonomy {id:$id})-[tl:HAS_TAXONOMY]-(n:Gene)-[nl:GO_LINK]-(g:db_GO)
                where n.name in $gene_names
                return n.name as gene, count(nl) as n_related_GO_terms
                limit 1000
                """,
                id=organism.id,
                gene_names=gene_names
        ).data()
