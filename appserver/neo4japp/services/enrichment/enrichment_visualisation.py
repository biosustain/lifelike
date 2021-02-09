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


class EnrichmentVisualisationService(KgService):
    def __init__(self, graph, session):
        super().__init__(graph=graph, session=session)

    def enrich_go(self, geneNames: List[str]):
        from neo4japp.services.enrichment.enrich_methods import fisher
        return fisher(geneNames, self.get_GO_terms())

    def get_GO_terms(self):
        try:
            import json
            data = {}
            with open('./neo4japp/services/enrichment/go.json') as json_file:
                data = json.load(json_file)
            return data
        except Exception as e:
            print(e)
            return self.graph.run(
                """
                match (n:Gene)-[:GO_LINK]-(g:db_GO)
                with n, g, labels(g) as go_labels
                return n.id as geneId, n.name as geneName, g.id as goId, g.name as goTerm, [lbl in go_labels where lbl<> 'db_GO'] as goLabel
                """
            ).data()
