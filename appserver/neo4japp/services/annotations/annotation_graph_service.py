from neo4j import Record as Neo4jRecord, Transaction as Neo4jTx
from typing import Dict, List

from .mixins.graph_mixin import GraphMixin


class AnnotationGraphService(GraphMixin):
    def get_chemicals_from_chemical_ids(self, chemical_ids: List[str]) -> Dict[str, str]:
        result = self.exec_read_query_with_params(
            self.get_chemicals_by_ids, {'ids': chemical_ids})
        return {row['chemical_id']: row['chemical_name'] for row in result}

    def get_compounds_from_compound_ids(self, compound_ids: List[str]) -> Dict[str, str]:
        result = self.exec_read_query_with_params(
            self.get_compounds_by_ids, {'ids': compound_ids})
        return {row['compound_id']: row['compound_name'] for row in result}

    def get_diseases_from_disease_ids(self, disease_ids: List[str]) -> Dict[str, str]:
        result = self.exec_read_query_with_params(
            self.get_diseases_by_ids, {'ids': disease_ids})
        return {row['disease_id']: row['disease_name'] for row in result}

    def get_genes_from_gene_ids(self, gene_ids: List[str]) -> Dict[str, str]:
        result = self.exec_read_query_with_params(
            self.get_genes_by_ids, {'ids': gene_ids})
        return {row['gene_id']: row['gene_name'] for row in result}

    def get_proteins_from_protein_ids(self, protein_ids: List[str]) -> Dict[str, str]:
        result = self.exec_read_query_with_params(
            self.get_proteins_by_ids, {'ids': protein_ids})
        return {row['protein_id']: row['protein_name'] for row in result}

    def get_organisms_from_organism_ids(self, organism_ids: List[str]) -> Dict[str, str]:
        result = self.exec_read_query_with_params(
            self.get_species_by_ids, {'ids': organism_ids})
        return {row['organism_id']: row['organism_name'] for row in result}

    def get_mesh_from_mesh_ids(self, mesh_ids: List[str]) -> Dict[str, str]:
        result = self.exec_read_query_with_params(self.get_mesh_by_ids, {'ids': mesh_ids})
        return {row['mesh_id']: row['mesh_name'] for row in result}

    def get_gene_to_organism_match_result(
        self,
        genes: List[str],
        postgres_genes: Dict[str, Dict[str, Dict[str, str]]],
        matched_organism_ids: List[str],
    ) -> Dict[str, Dict[str, Dict[str, str]]]:
        """Returns a map of gene name to gene id."""
        postgres_result = postgres_genes

        # Collect all the genes that were not matched to an organism in the table, and search
        # the Neo4j database for them
        second_round_genes = [gene for gene in genes if gene not in postgres_result.keys()]
        neo4j_result = self.get_genes_to_organisms(second_round_genes, matched_organism_ids)

        # Join the results of the two queries
        postgres_result.update(neo4j_result)

        return postgres_result

    def get_genes_to_organisms(
        self,
        genes: List[str],
        organisms: List[str],
    ) -> Dict[str, Dict[str, Dict[str, str]]]:
        gene_to_organism_map: Dict[str, Dict[str, Dict[str, str]]] = {}

        result = self.exec_read_query_with_params(
            self.get_gene_to_organism, {'genes': genes, 'organisms': organisms})

        for row in result:
            gene_name = row['gene_name']
            gene_synonym = row['gene_synonym']
            gene_id = row['gene_id']
            organism_id = row['organism_id']

            if gene_to_organism_map.get(gene_synonym, None) is not None:
                if gene_to_organism_map[gene_synonym].get(gene_name, None):
                    gene_to_organism_map[gene_synonym][gene_name][organism_id] = gene_id
                else:
                    gene_to_organism_map[gene_synonym][gene_name] = {organism_id: gene_id}
            else:
                gene_to_organism_map[gene_synonym] = {gene_name: {organism_id: gene_id}}

        return gene_to_organism_map

    def get_proteins_to_organisms(
        self,
        proteins: List[str],
        organisms: List[str],
    ) -> Dict[str, Dict[str, str]]:
        protein_to_organism_map: Dict[str, Dict[str, str]] = {}

        result = self.exec_read_query_with_params(
            self.get_protein_to_organism, {'proteins': proteins, 'organisms': organisms})

        for row in result:
            protein_name: str = row['protein']
            organism_id: str = row['organism_id']
            # For now just get the first protein in the list of matches,
            # no way for us to infer which to use
            gene_id: str = row['protein_ids'][0]

            if protein_to_organism_map.get(protein_name, None) is not None:
                protein_to_organism_map[protein_name][organism_id] = gene_id
            else:
                protein_to_organism_map[protein_name] = {organism_id: gene_id}

        return protein_to_organism_map

    def get_organisms_from_gene_ids(self, gene_ids: List[str]):
        return self.graph.run(
            self.get_organisms_from_gene_ids_query,
            gene_ids
        )

    def get_organisms_from_gene_ids_query(
        self,
        tx: Neo4jTx,
        gene_ids: List[str]
    ) -> List[Neo4jRecord]:
        """Retrieves a list of gene and corresponding organism data
        from a given list of genes."""
        return list(
            tx.run(
                """
                MATCH (g:Gene) WHERE g.id IN $gene_ids
                WITH g
                MATCH (g)-[:HAS_TAXONOMY]-(t:Taxonomy)
                RETURN g.id AS gene_id, g.name as gene_name, t.id as taxonomy_id,
                    t.name as species_name
                """,
                gene_ids=gene_ids
            )
        )
