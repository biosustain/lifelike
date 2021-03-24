import json
import logging
from functools import partial
from typing import List

from neo4japp.exceptions import ServerException
from neo4japp.services import KgService
from neo4japp.services.enrichment.enrich_methods import fisher

# Excessive logging noticeably slows down execution
logging.getLogger("py2neo.client.bolt").setLevel(logging.INFO)


class EnrichmentVisualisationService(KgService):
    def __init__(self, graph, session):
        super().__init__(graph=graph, session=session)

    def enrich_go(self, gene_names: List[str], analysis, organism):
        if analysis == 'fisher':
            return fisher(gene_names, self.get_go_terms(organism, gene_names),
                          self.get_go_term_count(organism))
        raise NotImplementedError

    def query_go_term(self, organism_id, gene_names):
        r = self.graph.run(
                """
match(n:Gene)-[:HAS_TAXONOMY]-(t:Taxonomy {id:$taxId}) where n.name in $gene_names
with n match (n)-[:GO_LINK]-(go) with distinct go
match (go)-[:GO_LINK]-(g:Gene)-[:HAS_TAXONOMY]-(t:Taxonomy {id:$taxId})
with go, collect(distinct g) as genes
return go.id as goId, go.name as goTerm, [lbl in labels(go) where lbl <> 'db_GO'] as goLabel,
[g in genes |g.name] as geneNames
                """,
                taxId=organism_id,
                gene_names=gene_names
        ).data()
        # raise if empty - should never happen so fail fast
        if not r:
            raise ServerException(
                message=f'Could not find related GO terms for organism id: {organism_id}')
        return r

    def get_go_terms(self, organism, gene_names):
        cache_id = f"get_go_terms_{organism}_{','.join(gene_names)}"
        return redis_cached(
                cache_id,
                partial(self.query_go_term, organism.id, gene_names),
                load=json.loads,
                dump=json.dumps
        )

    def query_go_term_count(self, organism_id):
        r = self.graph.run(
                """
match (n:Gene)-[:HAS_TAXONOMY]-(t:Taxonomy {id:$taxId})
with n match (n)-[:GO_LINK]-(go) with distinct go
return count(go)
                """,
                taxId=organism_id
        ).data()
        # raise if empty - should never happen so fail fast
        if not r:
            raise ServerException(
                message=f'Could not find related GO terms for organism id: {organism_id}')
        return r[0]['count(go)']

    def get_go_term_count(self, organism):
        cache_id = f"go_term_count_{organism}"
        return redis_cached(
                cache_id,
                partial(self.query_go_term_count, organism.id),
                load=json.loads,
                dump=json.dumps
        )
