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
                'worksheet_id': worksheet_id,
            }
        ).data()
    
    def get_uniprot_genes(
        self,
        ncbi_gene_ids: List[int],
    ):
        query = self.get_uniprot_genes_query()
        return self.graph.run(
            query,
            {
                'ncbi_gene_ids': ncbi_gene_ids,
            }
        ).data()

    def get_string_genes(
        self,
        ncbi_gene_ids: List[int],
    ):
        query = self.get_string_genes_query()
        return self.graph.run(
            query,
            {
                'ncbi_gene_ids': ncbi_gene_ids,
            }
        ).data()

    def get_molecular_go_genes(
        self,
        ncbi_gene_ids: List[int],
    ):
        query = self.get_molecular_go_genes_query()
        return self.graph.run(
            query,
            {
                'ncbi_gene_ids': ncbi_gene_ids,
            }
        ).data()

    def get_biological_go_genes(
        self,
        ncbi_gene_ids: List[int],
    ):
        query = self.get_biological_go_genes_query()
        return self.graph.run(
            query,
            {
                'ncbi_gene_ids': ncbi_gene_ids,
            }
        ).data()

    def get_cellular_go_genes(
        self,
        ncbi_gene_ids: List[int],
    ):
        query = self.get_cellular_go_genes_query()
        return self.graph.run(
            query,
            {
                'ncbi_gene_ids': ncbi_gene_ids,
            }
        ).data()

    def get_ecocyc_genes(
        self,
        ncbi_gene_ids: List[int],
    ):
        query = self.get_ecocyc_genes_query()
        return self.graph.run(
            query,
            {
                'ncbi_gene_ids': ncbi_gene_ids,
            }
        ).data()

    def get_regulon_genes(
        self,
        ncbi_gene_ids: List[int],
    ):
        query = self.get_regulon_genes_query()
        return self.graph.run(
            query,
            {
                'ncbi_gene_ids': ncbi_gene_ids,
            }
        ).data()

    def get_ncbi_genes_query(self):
        return """
        MATCH p=(w:Worksheet)<-[:IMPORTED_FROM]-(:UserData)-[:IS_A]-(x:Gene:db_NCBI)
        WHERE ID(w) = $worksheet_id RETURN x
        """

    def get_uniprot_genes_query(self):
        return """
        MATCH (g:Gene:db_NCBI)-[:HAS_GENE]-(x:db_UniProt)
        WHERE ID(g) IN $ncbi_gene_ids
        RETURN x
        """

    # Unsure what relationship between db_string and ncbi is 
    def get_string_genes_query(self):
        return """
        MATCH (g:Gene:db_NCBI)-[:HAS_STRING]-(x:db_STRING)
        WHERE ID(g) IN $ncbi_gene_ids
        RETURN x
        """

    def get_molecular_go_genes_query(self):
        return """
        MATCH (g:Gene:db_NCBI)-[:GO_LINK]-(x:MolecularFunction:db_GO)
        WHERE ID(g) IN $ncbi_gene_ids
        RETURN x
        """

    def get_biological_go_genes_query(self):
        return """
        MATCH (g:Gene:db_NCBI)-[:GO_LINK]-(x:BiologicalProcess:db_GO)
        WHERE ID(g) IN $ncbi_gene_ids
        RETURN x
        """

    def get_cellular_go_genes_query(self):
        return """
        MATCH (g:Gene:db_NCBI)-[:GO_LINK]-(x:CellularComponent:db_GO)
        WHERE ID(g) IN $ncbi_gene_ids
        RETURN x
        """

    def get_ecocyc_genes_query(self):
        return """
        MATCH (g:Gene:db_NCBI)-[:IS]-(x:db_EcoCyc)
        WHERE ID(g) IN $ncbi_gene_ids
        RETURN x
        """

    def get_regulon_genes_query(self):
        return """
        MATCH (g:Gene:db_NCBI)-[:IS]-(x:db_RegulonDB)
        WHERE ID(g) IN $ncbi_gene_ids
        RETURN x
        """
