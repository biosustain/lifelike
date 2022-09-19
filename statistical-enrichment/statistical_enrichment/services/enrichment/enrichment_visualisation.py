import json
from functools import partial
from typing import List

import pandas as pd
from flask import current_app

from .enrich_methods import fisher
from ..rcache import redis_cached, redis_server


class EnrichmentVisualisationService():
    def __init__(self, graph):
        self.graph = graph

    def enrich_go(self, gene_names: List[str], analysis, organism):
        if analysis == 'fisher':
            GO_terms = redis_server.get(f"GO_for_{organism.id}")
            if GO_terms:
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
                                WITH 
                                    g, 
                                    [(g)-[:GO_LINK {tax_id:$taxId}]-(go:db_GO) | go] as ncbi_go, 
                                    [(g)-[:IS]-(:db_BioCyc)-[:ENCODES]-(:Protein)-[:GO_LINK]-(go:db_GO) | go] as biocyc_go
                                UNWIND (ncbi_go + biocyc_go) as go
                                WITH DISTINCT go, collect(g) as genes
                                RETURN
                                    go.eid AS goId,
                                    go.name AS goTerm,
                                    [lbl IN labels(go) WHERE lbl <> 'db_GO'] AS goLabel,
                                    [g IN genes |g.name] AS geneNames
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
                            match (g:Gene)-[:HAS_TAXONOMY]-(t:Taxonomy {eid:$taxId})
                            WITH 
                                g, 
                                [(g)-[:GO_LINK {tax_id:$taxId}]-(go:db_GO) | go] as ncbi_go, 
                                [(g)-[:IS]-(:db_BioCyc)-[:ENCODES]-(:Protein)-[:GO_LINK]-(
                                go:db_GO) | go] as biocyc_go
                            UNWIND (ncbi_go + biocyc_go) as go
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
