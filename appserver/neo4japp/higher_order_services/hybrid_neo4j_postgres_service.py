from typing import Dict, List

from neo4japp.database import get_organism_gene_match_service
from neo4japp.database import get_neo4j_service_dao


class HybridNeo4jPostgresService:
    def get_gene_to_organism_match_result(
        self,
        genes: List[str],
        matched_organism_ids: List[str],
    ) -> Dict[str, Dict[str, str]]:
        """Returns a map of gene name to gene id."""
        organism_gene_match_service = get_organism_gene_match_service()
        neo4j = get_neo4j_service_dao()

        # First check if the gene/organism match exists in the postgres lookup table
        postgres_result = organism_gene_match_service.get_genes(genes, matched_organism_ids)

        # Collect all the genes that were not matched to an organism in the table, and search
        # the Neo4j database for them
        second_round_genes = [gene for gene in genes if gene not in postgres_result.keys()]
        neo4j_result = neo4j.get_genes_to_organisms(second_round_genes, matched_organism_ids)

        # Join the results of the two queries
        postgres_result.update(neo4j_result)

        return postgres_result
