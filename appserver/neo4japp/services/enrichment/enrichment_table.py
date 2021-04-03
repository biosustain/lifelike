from typing import List

from flask import current_app

from neo4japp.constants import EnrichmentDomain, LogEventType
from neo4japp.exceptions import AnnotationError, ServerException
from neo4japp.models import DomainURLsMap
from neo4japp.services import KgService
from neo4japp.services.enrichment.data_transfer_objects import EnrichmentCellTextMapping
from neo4japp.schemas.formats.enrichment_tables import validate_enrichment_table
from neo4japp.utils.logger import EventLog


class EnrichmentTableService(KgService):
    def __init__(self, graph, session):
        super().__init__(graph=graph, session=session)

    def create_annotation_mappings(self, enrichment: dict) -> EnrichmentCellTextMapping:
        try:
            validate_enrichment_table(enrichment)
        except Exception:
            raise AnnotationError(
                title='Could not annotate enrichment table',
                message='Could not annotate enrichment table, there was a problem validating the format.')  # noqa

        # got here so passed validation
        data = enrichment['result']

        total_index = 0
        cell_texts = []
        text_index_map = {}
        combined_text = ''

        # need to combine cell text together into one
        # the idea is to create a mapping to later identify
        # what row/column each text is originally in
        for i, gene in enumerate(data['genes']):
            # matched genes will have domains
            if gene.get('domains'):
                try:
                    cell_texts.append({'text': gene['imported'], 'index': i, 'domain': 'Imported', 'label': 'Imported'})  # noqa
                    cell_texts.append({'text': gene['matched'], 'index': i, 'domain': 'Matched', 'label': 'Matched'})  # noqa
                    cell_texts.append({'text': gene['fullName'], 'index': i, 'domain': 'Full Name', 'label': 'Full Name'})  # noqa

                    for k, v in gene['domains'].items():
                        if k == EnrichmentDomain.REGULON.value:
                            for k2, v2 in v.items():
                                cell_texts.append({'text': v2['text'], 'index': i, 'domain': k, 'label': k2})  # noqa
                        elif k == EnrichmentDomain.BIOCYC.value:
                            cell_texts.append({'text': v['Pathways']['text'], 'index': i, 'domain': k, 'label': 'Pathways'})  # noqa
                        elif k == EnrichmentDomain.GO.value or k == EnrichmentDomain.STRING.value:
                            cell_texts.append({'text': v['Annotation']['text'], 'index': i, 'domain': k, 'label': 'Annotation'})  # noqa
                        elif k == EnrichmentDomain.UNIPROT.value:
                            cell_texts.append({'text': v['Function']['text'], 'index': i, 'domain': k, 'label': 'Function'})  # noqa
                except KeyError:
                    current_app.logger.error(
                        f'Missing key when creating enrichment table text row/column mapping.',
                        extra=EventLog(event_type=LogEventType.ENRICHMENT.value).to_dict()
                    )
                    continue

        for text in cell_texts:
            if text['domain'] != EnrichmentDomain.GO.value and text['domain'] != EnrichmentDomain.BIOCYC.value:  # noqa
                combined_text += text['text']
                total_index = len(combined_text)
                text_index_map[total_index - 1] = text
                combined_text += ' '  # to separate prev text

        return EnrichmentCellTextMapping(
            text=combined_text, text_index_map=text_index_map, cell_texts=cell_texts)

    def match_ncbi_genes(self, gene_names: List[str], organism: str):
        """ Match list of gene names to list of NCBI gene nodes with same name and has taxonomy
            ID of given organism. Input order is maintained in result.
        """
        query = self.match_ncbi_genes_query()
        results = self.graph.run(
            query,
            {
                'gene_names': gene_names,
                'organism': organism
            }
        ).data()

        domain = self.session.query(DomainURLsMap).filter(
            DomainURLsMap.domain == 'NCBI_Gene').one_or_none()

        if domain is None:
            raise ServerException(
                title='Could not create enrichment table',
                message='There was a problem finding NCBI domain URLs.')

        return [{
            'gene': {
                'name': result['gene_name'],
                'full_name': result['gene_full_name']
            },
            'synonyms': result['synonyms'],
            'neo4jID': result['neo4j_id'],
            'link': domain.base_URL.format(
                result['gene_id']) if result['gene_id'] else ''} for result in results]

    def match_ncbi_genes_query(self):
        return """
        UNWIND $gene_names AS gene
        MATCH(s:Synonym {name:gene})-[:HAS_SYNONYM]-(g:Gene)-\
            [:HAS_TAXONOMY]-(t:Taxonomy {id:$organism})
        RETURN collect(s.name) AS synonyms, id(g) AS neo4j_id, \
            g.id AS gene_id, g.name AS gene_name, g.full_name AS gene_full_name
        """
