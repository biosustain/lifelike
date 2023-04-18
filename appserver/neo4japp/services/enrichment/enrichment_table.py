import time

from arango.client import ArangoClient
from flask import current_app
from typing import List
from urllib.parse import urlencode

from neo4japp.constants import BIOCYC_ORG_ID_DICT, EnrichmentDomain, KGDomain, LogEventType
from neo4japp.exceptions import AnnotationError
from neo4japp.schemas.formats.enrichment_tables import validate_enrichment_table
from neo4japp.services.arangodb import execute_arango_query, get_db
from neo4japp.util import compact
from neo4japp.utils.logger import EventLog

from .data_transfer_objects.dto import EnrichmentCellTextMapping


class EnrichmentTableService():
    def create_annotation_mappings(self, enrichment: dict) -> EnrichmentCellTextMapping:
        try:
            validate_enrichment_table(enrichment)
        except Exception:
            raise AnnotationError(
                title='Could not annotate enrichment table',
                message='Could not annotate enrichment table, '
                        'there was a problem validating the format.'
            )

        # got here so passed validation
        data = enrichment['result']

        total_index = 0
        cell_texts = []
        text_index_map = []
        combined_text = ''

        # need to combine cell text together into one
        # the idea is to create a mapping to later identify
        # what row/column each text is originally in
        for i, gene in enumerate(data['genes']):
            if gene.get('matched', None) is None:
                # gene did not match so ignore and don't annotate
                continue

            try:
                cell_texts.append({
                    'text': gene['imported'],
                    'index': i,
                    'domain': 'Imported',
                    'label': 'Imported'
                })
                cell_texts.append({
                    'text': gene['matched'],
                    'index': i,
                    'domain': 'Matched',
                    'label': 'Matched'
                })
                cell_texts.append({
                    'text': gene['fullName'],
                    'index': i,
                    'domain': 'Full Name',
                    'label': 'Full Name'
                })

                if gene.get('domains'):
                    for k, v in gene['domains'].items():
                        if k == EnrichmentDomain.REGULON.value:
                            for k2, v2 in v.items():
                                cell_texts.append({
                                    'text': v2['text'],
                                    'index': i,
                                    'domain': k,
                                    'label': k2
                                })
                        elif k == EnrichmentDomain.BIOCYC.value:
                            cell_texts.append({
                                'text': v['Pathways']['text'],
                                'index': i,
                                'domain': k,
                                'label': 'Pathways'
                            })
                        elif k == EnrichmentDomain.GO.value or k == EnrichmentDomain.STRING.value:
                            cell_texts.append({
                                'text': v['Annotation']['text'],
                                'index': i,
                                'domain': k,
                                'label': 'Annotation'
                            })
                        elif k == EnrichmentDomain.UNIPROT.value:
                            cell_texts.append({
                                'text': v['Function']['text'],
                                'index': i,
                                'domain': k,
                                'label': 'Function'
                            })
            except KeyError:
                current_app.logger.error(
                    f'Missing key when creating enrichment table text row/column mapping.',
                    extra=EventLog(event_type=LogEventType.ENRICHMENT.value).to_dict()
                )
                continue

        for text in cell_texts:
            domain = EnrichmentDomain.get(text['domain'])
            if domain not in (EnrichmentDomain.GO, EnrichmentDomain.BIOCYC):
                combined_text += text['text']
                total_index = len(combined_text)
                text_index_map.append((total_index - 1, text))
                combined_text += ' '  # to separate prev text

        return EnrichmentCellTextMapping(
            text=combined_text, text_index_map=text_index_map, cell_texts=cell_texts)


def match_ncbi_genes(
    arango_client: ArangoClient,
    gene_names: List[str],
    organism: str
):
    """ Match list of gene names to list of NCBI gene nodes with same name and has taxonomy
        ID of given organism. Input order is maintained in result.
    """
    results = execute_arango_query(
        db=get_db(arango_client),
        query=match_ncbi_genes_query(),
        gene_names=gene_names,
        organism=organism
    )

    retval = []
    for result in results:
        gene_id = result['gene_id'] if result['gene_id'] else ''
        retval.append({
            'gene': {'name': result['gene_name'], 'full_name': result['gene_full_name']},
            'synonym': result['synonym'],
            'geneArangoId': result['gene_arango_id'],
            'synonymArangoId': result['syn_arango_id'],
            'link': f"https://www.ncbi.nlm.nih.gov/gene/{gene_id}"
        })
    return retval


def get_uniprot_genes(arango_client: ArangoClient, ncbi_gene_ids: List[int]):
    start = time.time()
    results = execute_arango_query(
        db=get_db(arango_client),
        query=get_uniprot_genes_query(),
        ncbi_gene_ids=ncbi_gene_ids,
    )

    current_app.logger.info(
        f'Enrichment UniProt KG query time {time.time() - start}',
        extra=EventLog(event_type=LogEventType.ENRICHMENT.value).to_dict()
    )

    return {
        result['doc_id']: {
            'result': {'id': result['uniprot_id'], 'function': result['function']},
            'link': f'http://identifiers.org/uniprot/{result["uniprot_id"]}'
        } for result in results}


def get_string_genes(arango_client: ArangoClient, ncbi_gene_ids: List[int]):
    start = time.time()
    results = execute_arango_query(
        db=get_db(arango_client),
        query=get_string_genes_query(),
        ncbi_gene_ids=ncbi_gene_ids,
    )

    current_app.logger.info(
        f'Enrichment String KG query time {time.time() - start}',
        extra=EventLog(event_type=LogEventType.ENRICHMENT.value).to_dict()
    )

    return {
        result['doc_id']: {
            'result': {'id': result['string_id'], 'annotation': result['annotation']},
            'link': f"https://string-db.org/cgi/network?identifiers={result['string_id']}"
        } for result in results}


def get_biocyc_genes(arango_client: ArangoClient, ncbi_gene_ids: List[int], tax_id: str):
    start = time.time()
    results = execute_arango_query(
        db=get_db(arango_client),
        query=get_biocyc_genes_query(),
        ncbi_gene_ids=ncbi_gene_ids,
    )

    current_app.logger.info(
        f'Enrichment Biocyc KG query time {time.time() - start}',
        extra=EventLog(event_type=LogEventType.ENRICHMENT.value).to_dict()
    )

    return {
        result['doc_id']: {
            'result': result['pathways'],
            'link': "https://biocyc.org/gene?" + urlencode(compact(dict(
                orgid=BIOCYC_ORG_ID_DICT.get(tax_id, None), id=result['biocyc_id'])
            ))
        } for result in results
    }


def get_go_genes(arango_client: ArangoClient, ncbi_gene_ids: List[int]):
    start = time.time()
    results = execute_arango_query(
        db=get_db(arango_client),
        query=get_go_genes_query(),
        ncbi_gene_ids=ncbi_gene_ids,
    )

    current_app.logger.info(
        f'Enrichment GO KG query time {time.time() - start}',
        extra=EventLog(event_type=LogEventType.ENRICHMENT.value).to_dict()
    )

    return {
        result['doc_id']: {
            'result': result['go_terms'],
            'link': 'https://www.ebi.ac.uk/QuickGO/annotations?geneProductId='
        } for result in results}


def get_regulon_genes(arango_client: ArangoClient, ncbi_gene_ids: List[int]):
    start = time.time()
    results = execute_arango_query(
        db=get_db(arango_client),
        query=get_regulon_genes_query(),
        ncbi_gene_ids=ncbi_gene_ids,
    )

    current_app.logger.info(
        f'Enrichment Regulon KG query time {time.time() - start}',
        extra=EventLog(event_type=LogEventType.ENRICHMENT.value).to_dict()
    )

    return {
        result['doc_id']: {
            'result': result['node'],
            'link': "http://regulondb.ccg.unam.mx/gene?" + urlencode(compact(dict(
                term=result['regulondb_id'],
                organism='ECK12',
                format='jsp',
                type='gene'
            )))
        } for result in results}


def get_kegg_genes(arango_client: ArangoClient, ncbi_gene_ids: List[int]):
    start = time.time()
    results = execute_arango_query(
        db=get_db(arango_client),
        query=get_kegg_genes_query(),
        ncbi_gene_ids=ncbi_gene_ids,
    )

    current_app.logger.info(
        f'Enrichment KEGG KG query time {time.time() - start}',
        extra=EventLog(event_type=LogEventType.ENRICHMENT.value).to_dict()
    )

    return {
        result['doc_id']: {
            'result': result['pathway'],
            'link': f"https://www.genome.jp/entry/{result['kegg_id']}"
        } for result in results}


def get_genes(arango_client: ArangoClient, domain: KGDomain, gene_ids: List[int], tax_id: str):
    if domain == KGDomain.REGULON:
        return get_regulon_genes(arango_client, gene_ids)
    if domain == KGDomain.BIOCYC:
        return get_biocyc_genes(arango_client, gene_ids, tax_id)
    if domain == KGDomain.GO:
        return get_go_genes(arango_client, gene_ids)
    if domain == KGDomain.STRING:
        return get_string_genes(arango_client, gene_ids)
    if domain == KGDomain.UNIPROT:
        return get_uniprot_genes(arango_client, gene_ids)
    if domain == KGDomain.KEGG:
        return get_kegg_genes(arango_client, gene_ids)


def match_ncbi_genes_query() -> str:
    """Need to collect synonyms because a gene node can have multiple
    synonyms. So it is possible to send duplicate internal node ids to
    a later query."""
    return """
        FOR name IN @gene_names
            FOR s IN synonym
                FILTER s.name == name
                FOR g IN INBOUND s has_synonym
                    FILTER 'Gene' IN g.labels
                    FOR t IN OUTBOUND g has_taxonomy
                        FILTER t.eid == @organism
                        RETURN {
                            synonym: s.name,
                            syn_arango_id: s._id,
                            gene_arango_id: g._id,
                            gene_id: g.eid,
                            gene_name: g.name,
                            gene_full_name: g.full_name
                        }
    """


def get_uniprot_genes_query() -> str:
    return """
        FOR gene_id IN @ncbi_gene_ids
            FOR n IN ncbi
                FILTER n._id == gene_id
                FOR x IN INBOUND n has_gene OPTIONS { vertexCollections:'uniprot' }
                    RETURN {
                        doc_id: n._id,
                        function: x.function,
                        uniprot_id: x.eid
                    }
    """


def get_string_genes_query() -> str:
    return """
        FOR gene_id IN @ncbi_gene_ids
            FOR n IN ncbi
                FILTER n._id == gene_id
                FILTER 'Gene' IN n.labels
                FOR x  IN INBOUND n has_gene  OPTIONS { vertexCollections: ["string"] }
                    RETURN {
                        doc_id: n._id,
                        string_id: x.eid,
                        annotation: x.annotation,
                    }
    """


def get_go_genes_query() -> str:
    return """
        FOR gene_id IN @ncbi_gene_ids
            FOR n IN ncbi
                FILTER n._id == gene_id
                LET go_terms = (
                    FOR g IN OUTBOUND n go_link OPTIONS { vertexCollections:'go' }
                    RETURN g.name
                )
                FILTER length(go_terms) > 0
                RETURN {
                    doc_id: n._id,
                    go_terms: go_terms
                }
    """


def get_biocyc_genes_query() -> str:
    return """
        FOR gene_id IN @ncbi_gene_ids
            FOR n IN ncbi
                FILTER n._id == gene_id
                FOR b IN INBOUND n is OPTIONS { vertexCollections:'biocyc' }
                    RETURN {
                        doc_id: n._id,
                        pathways: b.pathways,
                        biocyc_id: b.biocyc_id
                    }
    """


def get_regulon_genes_query() -> str:
    return """
        FOR gene_id IN @ncbi_gene_ids
            FOR n IN ncbi
                FILTER n._id == gene_id
                FILTER 'Gene' IN n.labels
                FOR x IN INBOUND n is OPTIONS { vertexCollections: ["regulondb"] }
                    RETURN {
                        doc_id: n._id,
                        node: x,
                        regulondb_id: x.regulondb_id
                    }
    """


def get_kegg_genes_query() -> str:
    return """
        FOR gene_id IN @ncbi_gene_ids
            FOR n IN ncbi
                FILTER n._id == gene_id
                FILTER 'Gene' IN n.labels
                FOR x IN INBOUND n is OPTIONS { vertexCollections: ["kegg"] }
                    FOR gnm IN OUTBOUND x has_ko
                        LET pathway = (
                            FOR pth IN OUTBOUND gnm in_pathway
                            RETURN pth.name
                        )
                        FILTER length(pathway)  > 0
                        RETURN {
                            doc_id: n._id,
                            kegg_id: x.eid,
                            pathway: pathway
                        }
    """
