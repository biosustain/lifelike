import json
import logging
from functools import partial
from typing import List

from neo4japp.services import KgService
from neo4japp.services.enrichment.enrich_methods import fisher
from neo4japp.services.redis import redis_cached

# Excessive logging noticeably slows down execution
logging.getLogger("py2neo.client.bolt").setLevel(logging.INFO)


class EnrichmentVisualisationService(KgService):
    def __init__(self, graph, session):
        super().__init__(graph=graph, session=session)

    def enrich_go(self, gene_names: List[str], analysis, organism):
        if analysis == 'fisher':
            return fisher(gene_names, self.get_go_terms(organism))
        raise NotImplementedError

    def query_go_term(self, organism_id):
        return self.graph.run(
                """
                MATCH (:Taxonomy {id:$id})-
                       [:HAS_TAXONOMY]-(n:Gene)-[:GO_LINK]-(g:db_GO)
                WITH n, g, labels(g) AS go_labels
                RETURN
                    n.id AS geneId, n.name AS geneName, g.id AS goId, g.name AS goTerm,
                    [lbl IN go_labels WHERE lbl<> 'db_GO'] AS goLabel
                LIMIT 100000
                """,
                id=organism_id
        ).data()

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
