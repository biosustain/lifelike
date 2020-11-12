from typing import List

from neo4japp.constants import DISPLAY_NAME_MAP
from neo4japp.data_transfer_objects.visualization import (
    Direction,
    DuplicateEdgeConnectionData,
    EdgeConnectionData,
    GetClusterSnippetsResult,
    GetEdgeSnippetsResult,
    GetReferenceTableDataResult,
    GetSnippetsFromEdgeResult,
    ReferenceTablePair,
    ReferenceTableRow,
    Snippet,
)
from neo4japp.models import (
    DomainURLsMap,
)
from neo4japp.models import GraphNode, GraphRelationship
from neo4japp.services import KgService
from neo4japp.util import get_first_known_label_from_node


class EnrichmentTableService(KgService):
    def __init__(self, graph, session):
        super().__init__(graph=graph, session=session)

    def match_ncbi_genes(self, geneNames: List[str], organism: str):
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
