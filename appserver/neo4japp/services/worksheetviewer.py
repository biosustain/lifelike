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
from neo4japp.models import GraphNode, GraphRelationship
from neo4japp.services import KgService
from neo4japp.util import get_first_known_label_from_node


class WorksheetViewerService(KgService):
    def __init__(self, graph, session):
        super().__init__(graph=graph, session=session)

    def get_ncbi_genes(self, worksheet_id: int):
        query = self.get_ncbi_genes_query()
        return self.graph.run(
            query,
            {
                'worksheet_id': int(worksheet_id),
            }
        ).data()

    def get_ncbi_genes_query(self):
        return """
        MATCH (w:Worksheet)<-[:IMPORTED_FROM]-(import:UserData)-[:IS_A]-(x:Gene:db_NCBI)
        WHERE ID(w) = $worksheet_id RETURN import, x, ID(x) as neo4jID
        """
