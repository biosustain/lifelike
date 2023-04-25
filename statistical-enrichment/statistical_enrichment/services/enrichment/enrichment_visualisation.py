import json
from flask import current_app
from functools import partial
from typing import List

import pandas as pd
from .enrich_methods import fisher
from ..rcache import redis_cached, redis_server


class EnrichmentVisualisationService:
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
            gene_ids = [g['geneId'] for g in self.get_gene_ids(organism, gene_names)]
            return fisher(gene_ids, go, go_count)
        raise NotImplementedError

    def query_gene_id(self, organism_id, gene_names):
        return self.graph.read_transaction(
            lambda tx: list(
                tx.run(
                    """
                    UNWIND $gene_names AS geneName
                    MATCH (g:Gene)-[:HAS_TAXONOMY]-(t:Taxonomy {eid:$taxId})
                    WHERE g.name=geneName
                    // Get cluster aware eid
                    CALL {
                        WITH g
                        MATCH p=(g)-[:IS*0..2]-()
                        UNWIND nodes(p) as gene
                        WITH gene.eid as gene_eid ORDER BY gene_eid
                        RETURN apoc.text.join(collect(DISTINCT gene_eid), ',') as geneId
                    }
                    RETURN geneId
                    """,
                    taxId=organism_id,
                    gene_names=gene_names
                ).data()
            )
        )

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
                        // BioCyc db 'GO_LINK's does not have tax_id property so we need to filter in this way
                        MATCH (g)-[:IS]-(:db_BioCyc)-[:ENCODES]-(:Protein)-[:GO_LINK]-(go:db_GO)
                        WITH DISTINCT go
                        MATCH (go)-[:GO_LINK]-(:Protein)-[:ENCODES]-(bgene:db_BioCyc)-[:IS]-(go_gene:Gene {tax_id:$taxId})
                        RETURN go, go_gene
                    }
                    WITH
                        DISTINCT go,
                        collect(DISTINCT go_gene) AS go_genes
                    // Get cluster aware eid
                    CALL {
                        WITH go_genes
                        UNWIND go_genes as go_gene
                        MATCH p=(go_gene)-[:IS*0..2]-()
                        UNWIND nodes(p) as gene
                        WITH go_gene, gene.eid as gene_eid ORDER BY gene_eid
                        WITH go_gene, apoc.text.join(collect(DISTINCT gene_eid), ',') as go_genes_eid
                        RETURN collect(DISTINCT go_genes_eid) as go_genes_eids
                    }
                    RETURN
                        go.eid AS goId,
                        go.name AS goTerm,
                        // Return all but 'db_GO' labels
                        [lbl IN labels(go) WHERE lbl <> 'db_GO'] AS goLabel,
                        go_genes_eids AS geneIds,
                        [g IN go_genes |g.name] AS geneNames
                    """,
                    taxId=organism_id,
                    gene_names=gene_names,
                ).data()
            )
        )
        if not r:
            current_app.logger.warning(
                f'Could not find related GO terms for organism id: {organism_id}'
            )
        return r

    def get_gene_ids(self, organism, gene_names):
        cache_id = f"get_gene_ids_{organism}_{','.join(gene_names)}"
        return redis_cached(
                cache_id,
                partial(self.query_gene_id, organism.id, gene_names),
                load=json.loads,
                dump=json.dumps
        )

    def get_go_terms(self, organism, gene_names):
        cache_id = f"get_go_terms_{organism}_{','.join(gene_names)}"
        return redis_cached(
            cache_id,
            partial(self.query_go_term, organism.id, gene_names),
            load=json.loads,
            dump=json.dumps,
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
                    taxId=organism_id,
                )
            )
        )
        if not r:
            current_app.logger.warning(
                f'Could not find related GO terms for organism id: {organism_id}'
            )
        return r[0]['go_count']

    def get_go_term_count(self, organism):
        cache_id = f"go_term_count_{organism}"
        return redis_cached(
            cache_id,
            partial(self.query_go_term_count, organism.id),
            load=json.loads,
            dump=json.dumps,
        )
