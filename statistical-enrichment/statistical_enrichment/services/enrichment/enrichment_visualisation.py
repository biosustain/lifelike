from arango import ArangoClient
from flask import current_app
from functools import partial
import json
import pandas as pd
from typing import List

from ..arangodb import execute_arango_query, get_db
from .enrich_methods import fisher
from ..rcache import redis_cached, redis_server


def enrich_go(arango_client: ArangoClient, gene_names: List[str], analysis, organism):
    if analysis == 'fisher':
        GO_terms = redis_server.get(f"GO_for_{organism.id}")
        if GO_terms is not None:
            df = pd.read_json(GO_terms)
            go_count = len(df)
            mask = ~df.geneNames.map(set(gene_names).isdisjoint)
            go = df[mask]
        else:
            go = redis_cached(
                    f"get_go_terms_{organism}_{','.join(gene_names)}_x",
                    partial(get_go_terms, arango_client, organism.id, gene_names),
                    load=json.loads,
                    dump=json.dumps
            )
            go_count = redis_cached(
                    f"go_term_count_{organism.id}",
                    partial(get_go_term_count, arango_client, organism.id),
                    load=json.loads,
                    dump=json.dumps
            )
        return fisher(gene_names, go, go_count)
    raise NotImplementedError


def get_go_terms(arango_client: ArangoClient, tax_id, gene_names: List[str]):
    result = execute_arango_query(
        db=get_db(arango_client),
        query=go_term_query(),
        gene_names=gene_names,
        tax_id=tax_id
    )
    if not result:
        current_app.logger.warning(f'Could not find related GO terms for organism id: {tax_id}')
    return result


def get_go_term_count(arango_client: ArangoClient, tax_id):
    result = execute_arango_query(
        db=get_db(arango_client),
        query=go_term_count_query(),
        tax_id=tax_id
    )
    if not result:
        current_app.logger.warning(f'Could not find related GO terms for organism id: {tax_id}')
        return None
    return result[0]


def go_term_query():
    return """
    LET original_master_genes = (
        FOR organism IN taxonomy
            FILTER organism.eid == @tax_id
            FOR master_gene IN INBOUND organism has_taxonomy
                FILTER "Gene" IN master_gene.labels
                FILTER master_gene.name IN @gene_names
                RETURN master_gene
    )
    LET organism_genes = (
        FOR organism IN taxonomy
            FILTER organism.eid == @tax_id
            FOR gene IN INBOUND organism has_taxonomy
                RETURN gene
    )

    FOR original_gene IN original_master_genes
        LET results = UNION(
            (
                FOR go_term IN OUTBOUND original_gene go_link
                    LET linked_gene_names = (
                        FOR gene IN organism_genes
                            FOR go IN OUTBOUND gene go_link
                                FILTER go._key == go_term._key
                                RETURN gene.name
                    )
                    RETURN DISTINCT {
                        "goId": go_term.eid,
                        "goTerm": go_term.name,
                        "goLabel": go_term.labels,
                        "geneNames": linked_gene_names
                    }
            ),
            (
                LET biocyc_go_terms = (
                    FOR biocyc_gene IN INBOUND original_gene is
                        FOR protein IN OUTBOUND biocyc_gene encodes
                            FOR go_term IN OUTBOUND protein go_link
                                RETURN DISTINCT go_term
                )
                FOR go_term IN biocyc_go_terms
                    LET linked_gene_names = (
                        FOR gene IN organism_genes
                            FOR biocyc_gene IN INBOUND gene is
                                FOR protein IN OUTBOUND biocyc_gene encodes
                                    FOR go IN OUTBOUND protein go_link
                                        FILTER go._key == go_term._key
                                        RETURN gene.name
                    )
                    RETURN DISTINCT {
                        "goId": go_term.eid,
                        "goTerm": go_term.name,
                        "goLabel": go_term.labels,
                        "geneNames": linked_gene_names
                    }
            )
        )
        FOR result IN results
            COLLECT id = result.goId, term = result.goTerm, label = result.goLabel INTO genes = result.geneNames
            RETURN DISTINCT {
                "goId": id,
                "goTerm": term,
                "goLabel": label,
                "geneNames": UNIQUE(FLATTEN(genes))
            }
    """

def go_term_count_query():
    return """
    LET linked_gene_names = (
        FOR organism IN taxonomy
            FILTER organism.eid == @tax_id
            FOR linked_gene IN INBOUND organism has_taxonomy
                FILTER "Gene" IN linked_gene.labels
                RETURN linked_gene
    )

    LET go_terms = (
        FOR gene IN linked_gene_names
            LET results = UNION(
                (
                    FOR go_term IN OUTBOUND gene go_link
                        RETURN DISTINCT go_term
                ),
                (
                    FOR biocyc_gene IN INBOUND gene is
                        FOR protein IN OUTBOUND biocyc_gene encodes
                            FOR go_term IN OUTBOUND protein go_link
                                RETURN DISTINCT go_term
                )
            )
            FOR result IN results
                RETURN DISTINCT result
    )
    RETURN COUNT(go_terms)
    """
