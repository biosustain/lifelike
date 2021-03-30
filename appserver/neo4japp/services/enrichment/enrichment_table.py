from typing import List

from neo4japp.constants import EnrichmentDomain
from neo4japp.exceptions import InvalidArgument
from neo4japp.models import DomainURLsMap
from neo4japp.services import KgService
from neo4japp.services.enrichment.data_transfer_objects import EnrichmentCellTextMapping
from neo4japp.schemas.formats.enrichment_tables import validate_enrichment_table


class EnrichmentTableService(KgService):
    def __init__(self, graph, session):
        super().__init__(graph=graph, session=session)

    def create_annotation_mappings(self, enrichment: dict) -> EnrichmentCellTextMapping:
        validate_enrichment_table(enrichment)

        # got here so passed validation
        data = enrichment['result']

        # need to combine cell text together into one
        total_index = 0
        cell_texts = []
        text_index_map = {}
        combined_text = ''

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
                    continue  # maybe raise?

        for text in cell_texts:
            if text['domain'] != EnrichmentDomain.GO.value and text['domain'] != EnrichmentDomain.BIOCYC.value:  # noqa
                combined_text += text['text']
                total_index = len(combined_text)
                text_index_map[total_index - 1] = text
                combined_text += ' '  # to separate prev text

        return EnrichmentCellTextMapping(
            text=combined_text, text_index_map=text_index_map, cell_texts=cell_texts)

    def match_ncbi_genes(self, geneNames: List[str], organism: str):
        """ Match list of gene names to list of NCBI gene nodes with same name and has taxonomy
            ID of given organism. Input order is maintained in result.
        """
        query = self.match_ncbi_genes_query()
        result = self.graph.run(
            query,
            {
                'geneNames': geneNames,
                'organism': organism
            }
        ).data()
        result_list = []
        domain = self.session.query(DomainURLsMap).filter(
                                        DomainURLsMap.domain == 'NCBI_Gene').one()
        for meta_result in result:
            item = {'x': meta_result['x'], 'neo4jID': meta_result['neo4jID'], 's': meta_result['s']}
            if (meta_result['x'] is not None):
                item['link'] = domain.base_URL.format(meta_result['x']['id'])
            result_list.append(item)
        return result_list

    def match_ncbi_genes_query(self):
        return """
        WITH $geneNames as genes
        UNWIND range(0, size(genes) - 1) as index
        MATCH (s:Synonym{name:genes[index]})<-[:HAS_SYNONYM]-(g:Gene:db_NCBI)-[:HAS_TAXONOMY]->
        (t:Taxonomy)
        WHERE t.id=$organism
        WITH index, s, g as x, ID(g) as neo4jID
        ORDER BY index ASC
        RETURN s, x, neo4jID, index
        """
