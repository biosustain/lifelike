import json
from flask import current_app
from functools import partial
from typing import List

import pandas as pd
from .enrich_methods import fisher
from ..rcache import redis_cached, redis_server


class EnrichmentVisualisationService():
    def __init__(self, graph):
        self.graph = graph

    def enrich_go(self, gene_names: List[str], analysis, organism):
        if analysis == 'fisher':
            GO_terms = redis_server.get(f"GO_for_{organism.id}")
            if GO_terms is not None:
                df = pd.read_json(GO_terms)
                go_count = len(df)
                mask = ~df.geneNames.map(set(gene_names).isdisjoint)
                go = df[mask]
            else:
                go = self.get_go_terms(organism, gene_names)
                go_count = self.get_go_term_count(organism)
            return fisher(gene_names, go, go_count)
        raise NotImplementedError

    def query_go_term(self, organism_id, gene_names):
        r = self.graph.read_transaction(
            lambda tx: list(
                tx.run(
                    """
                    UNWIND $gene_names AS geneName
                    MATCH (g:Gene)-[:HAS_TAXONOMY]-(t:Taxonomy {eid:$taxId}) 
                    WHERE g.name=geneName
                    CALL {
                        // Make simple run by relations we has from GO db
                        WITH g
                        MATCH (g)-[:GO_LINK]-(go:db_GO)
                        WITH DISTINCT go
                        // GO db 'GO_LINK's has tax_id property so we can filter in this way
                        MATCH (go)-[:GO_LINK {tax_id:$taxId}]-(go_gene:Gene)
                        RETURN go, go_gene
                    UNION
                        // Fetch GO relations defined in BioCyc
                        WITH g
                        MATCH (g)-[:IS]-(:db_BioCyc)-[:ENCODES]-(:Protein)-[:GO_LINK]-(go:db_GO)
                        WITH DISTINCT go 
                        // BioCyc db 'GO_LINK's does not have tax_id property so we need to filter in this way
                        MATCH (go)-[:GO_LINK]-(go_gene:Gene)-[:HAS_TAXONOMY]-(t:Taxonomy {eid:$taxId})
                        RETURN go, go_gene
                    }
                    WITH 
                        DISTINCT go, 
                        collect(DISTINCT go_gene) AS go_genes
                    RETURN
                        go.eid AS goId,
                        go.name AS goTerm,
                        // Return all but 'db_GO' labels 
                        [lbl IN labels(go) WHERE lbl <> 'db_GO'] AS goLabel,
                        [g IN go_genes |g.name] AS geneNames
                    """,
                    taxId=organism_id,
                    gene_names=gene_names
                ).data()
            )
        )
        if not r:
            current_app.logger.warning(f'Could not find related GO terms for organism id: {organism_id}')
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
        r = self.graph.read_transaction(
            lambda tx: list(
                tx.run(
                    """
                    MATCH (g:Gene)-[:HAS_TAXONOMY]-(t:Taxonomy {eid:$taxId})
                    CALL {
                        WITH g
                        MATCH (g)-[:GO_LINK]-(go:db_GO)
                        RETURN go
                    UNION
                        WITH g
                        MATCH (g)-[:IS]-(:db_BioCyc)-[:ENCODES]-(:Protein)-[:GO_LINK]-(go:db_GO)
                        RETURN go
                    }
                    return count(distinct go) as go_count
                    """,
                    taxId=organism_id
                )
            )
        )
        if not r:
            current_app.logger.warning(f'Could not find related GO terms for organism id: {organism_id}')
        return r[0]['go_count']

    def get_go_term_count(self, organism):
        cache_id = f"go_term_count_{organism}"
        return redis_cached(
                cache_id,
                partial(self.query_go_term_count, organism.id),
                load=json.loads,
                dump=json.dumps
        )
