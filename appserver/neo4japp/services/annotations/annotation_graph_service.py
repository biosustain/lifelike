from typing import Dict, List

from neo4japp.database import GraphConnection


class AnnotationGraphService(GraphConnection):
    def get_chemicals_from_chemical_ids(self, chemical_ids: List[str]) -> Dict[str, str]:
        query = self.get_chemicals_from_chemical_ids_query()
        result = self.graph.run(query, {'chemical_ids': chemical_ids}).data()
        return {row['chemical_id']: row['chemical_name'] for row in result}

    def get_compounds_from_compound_ids(self, compound_ids: List[str]) -> Dict[str, str]:
        query = self.get_compounds_from_compound_ids_query()
        result = self.graph.run(query, {'compound_ids': compound_ids}).data()
        return {row['compound_id']: row['compound_name'] for row in result}

    def get_diseases_from_disease_ids(self, disease_ids: List[str]) -> Dict[str, str]:
        query = self.get_diseases_from_disease_ids_query()
        result = self.graph.run(query, {'disease_ids': disease_ids}).data()
        return {row['disease_id']: row['disease_name'] for row in result}

    def get_genes_from_gene_ids(self, gene_ids: List[str]) -> Dict[str, str]:
        query = self.get_genes_from_gene_ids_query()
        result = self.graph.run(query, {'gene_ids': gene_ids}).data()
        return {row['gene_id']: row['gene_name'] for row in result}

    def get_proteins_from_protein_ids(self, protein_ids: List[str]) -> Dict[str, str]:
        query = self.get_proteins_from_protein_ids_query()
        result = self.graph.run(query, {'protein_ids': protein_ids}).data()
        return {row['protein_id']: row['protein_name'] for row in result}

    def get_organisms_from_organism_ids(self, organism_ids: List[str]) -> Dict[str, str]:
        query = self.get_organisms_from_organism_ids_query()
        result = self.graph.run(query, {'organism_ids': organism_ids}).data()
        return {row['organism_id']: row['organism_name'] for row in result}

    def get_mesh_from_mesh_ids(self, mesh_ids: List[str]) -> Dict[str, str]:
        query = self.get_mesh_from_mesh_ids_query()
        result = self.graph.run(query, {'mesh_ids': mesh_ids}).data()
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

        query = self.get_gene_to_organism_query()
        cursor = self.graph.run(
            query,
            {
                'genes': genes,
                'organisms': organisms,
            }
        )

        result = cursor.data()
        cursor.close()

        for row in result:
            gene_name: str = row['gene_name']
            gene_synonym: str = row['gene_synonym']
            gene_id: str = row['gene_id']
            organism_id: str = row['organism_id']

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

        query = self.get_protein_to_organism_query()
        cursor = self.graph.run(
            query,
            {
                'proteins': proteins,
                'organisms': organisms,
            }
        )

        result = cursor.data()
        cursor.close()

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
        query = self.get_organisms_from_gene_ids_query()
        result = self.graph.run(
            query, {
                'gene_ids': gene_ids
            }
        ).data()
        return result

    def get_gene_to_organism_query(self):
        """Retrieves a list of all the genes with a given name
        in a particular organism."""
        query = """
            MATCH (s:Synonym)-[]-(g:Gene)
            WHERE s.name IN $genes
            WITH s, g MATCH (g)-[:HAS_TAXONOMY]-(t:Taxonomy)-[:HAS_PARENT*0..2]->(p:Taxonomy)
            WHERE p.id IN $organisms
            RETURN g.name AS gene_name, s.name AS gene_synonym, g.id AS gene_id, p.id AS organism_id
        """
        return query

    def get_protein_to_organism_query(self):
        """Retrieves a list of all the protein with a given name
        in a particular organism."""
        query = """
            MATCH (s:Synonym)-[]-(g:db_UniProt)
            WHERE s.name IN $proteins
            WITH s, g MATCH (g)-[:HAS_TAXONOMY]-(t:Taxonomy)-[:HAS_PARENT*0..2]->(p:Taxonomy)
            WHERE p.id IN $organisms
            RETURN s.name AS protein, collect(g.id) AS protein_ids, p.id AS organism_id
        """
        return query

    def get_mesh_from_mesh_ids_query(self):
        query = """
            MATCH (n) WHERE n:db_MESH and n:TopicalDescriptor and n.id IN $mesh_ids
            RETURN n.id AS mesh_id, n.name AS mesh_name
        """
        return query

    def get_chemicals_from_chemical_ids_query(self):
        query = """
            MATCH (c:Chemical) WHERE c.id IN $chemical_ids
            RETURN c.id AS chemical_id, c.name AS chemical_name
        """
        return query

    def get_compounds_from_compound_ids_query(self):
        query = """
            MATCH (c:Compound) WHERE c.biocyc_id IN $compound_ids
            RETURN c.biocyc_id AS compound_id, c.name AS compound_name
        """
        return query

    def get_diseases_from_disease_ids_query(self):
        query = """
            MATCH (d:Disease) WHERE d.id IN $disease_ids
            RETURN d.id AS disease_id, d.name AS disease_name
        """
        return query

    def get_genes_from_gene_ids_query(self):
        query = """
            MATCH (g:Gene) WHERE g.id IN $gene_ids
            RETURN g.id AS gene_id, g.name AS gene_name
        """
        return query

    def get_proteins_from_protein_ids_query(self):
        query = """
            MATCH (p:db_UniProt) WHERE p.id IN $protein_ids
            RETURN p.id AS protein_id, p.name AS protein_name
        """
        return query

    def get_organisms_from_organism_ids_query(self):
        query = """
            MATCH (t:Taxonomy) WHERE t.id IN $organism_ids
            RETURN t.id AS organism_id, t.name AS organism_name
        """
        return query

    def get_organisms_from_gene_ids_query(self):
        """Retrieves a list of gene and corresponding organism data
        from a given list of genes."""
        query = """
            MATCH (g:Gene) WHERE g.id IN $gene_ids
            WITH g
            MATCH (g)-[:HAS_TAXONOMY]-(t:Taxonomy)
            RETURN g.id AS gene_id, g.name as gene_name, t.id as taxonomy_id, t.name as species_name
        """
        return query
