from neo4japp.database import GraphConnection


class GraphMixin(GraphConnection):
    def exec_read_query(self, query: str):
        return self.graph.read_transaction(lambda tx: list(tx.run(query)))

    def exec_write_query(self, query: str):
        return self.graph.write_transaction(lambda tx: list(tx.run(query)))

    def exec_read_query_with_params(self, query: str, values: dict):
        return self.graph.read_transaction(lambda tx: list(tx.run(query, values=values)))

    def exec_write_query_with_params(self, query: str, values: dict):
        return self.graph.write_transaction(lambda tx: list(tx.run(query, values=values)))

    @property
    def get_gene_to_organism(self):
        return """
        WITH $values AS row
        MATCH (s:Synonym)-[]-(g:Gene)
        WHERE s.name IN row.genes
        WITH row, s, g MATCH (g)-[:HAS_TAXONOMY]-(t:Taxonomy)-[:HAS_PARENT*0..2]->(p:Taxonomy)
        WHERE p.id IN row.organisms
        RETURN g.name AS gene_name, s.name AS gene_synonym, g.id AS gene_id,
            p.id AS organism_id
        """

    @property
    def get_protein_to_organism(self):
        return """
        WITH $values AS row
        MATCH (s:Synonym)-[]-(g:db_UniProt)
        WHERE s.name IN row.proteins
        WITH row, s, g MATCH (g)-[:HAS_TAXONOMY]-(t:Taxonomy)-[:HAS_PARENT*0..2]->(p:Taxonomy)
        WHERE p.id IN row.organisms
        RETURN s.name AS protein, collect(g.id) AS protein_ids, p.id AS organism_id
        """

    @property
    def get_chemicals_by_ids(self):
        return """
        MATCH (c:Chemical) WHERE c.id IN $values.ids
        RETURN c.id AS chemical_id, c.name AS chemical_name
        """

    @property
    def get_compounds_by_ids(self):
        return """
        MATCH (c:Compound) WHERE c.biocyc_id IN $values.ids
        RETURN c.biocyc_id AS compound_id, c.name AS compound_name
        """

    @property
    def get_diseases_by_ids(self):
        return """
        MATCH (d:Disease) WHERE d.id IN $values.ids
        RETURN d.id AS disease_id, d.name AS disease_name
        """

    @property
    def get_genes_by_ids(self):
        return """
        MATCH (g:Gene) WHERE g.id IN $values.ids
        RETURN g.id AS gene_id, g.name AS gene_name
        """

    @property
    def get_mesh_by_ids(self):
        return """
        MATCH (n:db_MESH:TopicalDescriptor) WHERE n.id IN $values.ids
        RETURN n.id AS mesh_id, n.name AS mesh_name
        """

    @property
    def get_proteins_by_ids(self):
        return """
        MATCH (p:db_UniProt) WHERE p.id IN $values.ids
        RETURN p.id AS protein_id, p.name AS protein_name
        """

    @property
    def get_species_by_ids(self):
        return """
        MATCH (t:Taxonomy) WHERE t.id IN $values.ids
        RETURN t.id AS organism_id, t.name AS organism_name
        """

    @property
    def get_mesh_global_inclusions_by_type(self):
        return """
        WITH $values AS row
        MATCH (n:db_MESH)-[r:HAS_SYNONYM]-(s)
        WHERE exists(n.inclusion_date) AND exists(r.inclusion_date)
        AND n.entity_type = row.entity_type
        RETURN n.id AS entity_id, n.name AS entity_name,
            s.name AS synonym, n.data_source AS data_source
        """

    @property
    def get_gene_global_inclusions(self):
        return """
        MATCH (n:Gene)-[r:HAS_SYNONYM]-(s)
        WHERE exists(n.inclusion_date) AND exists(r.inclusion_date)
        RETURN n.id AS entity_id, n.name AS entity_name,
            s.name AS synonym, n.data_source AS data_source
        """

    @property
    def get_protein_global_inclusions(self):
        return """
        MATCH (n:db_UniProt)-[r:HAS_SYNONYM]-(s)
        WHERE exists(n.inclusion_date) AND exists(r.inclusion_date)
        RETURN n.id AS entity_id, n.name AS entity_name,
            s.name AS synonym, n.data_source AS data_source
        """

    @property
    def get_species_global_inclusions(self):
        return """
        MATCH (n:Taxonomy)-[r:HAS_SYNONYM]-(s)
        WHERE exists(n.inclusion_date) AND exists(r.inclusion_date)
        RETURN n.id AS entity_id, n.name AS entity_name,
            s.name AS synonym, n.data_source AS data_source
        """

    @property
    def get_***ARANGO_DB_NAME***_global_inclusions_by_type(self):
        return """
        WITH $values AS row
        MATCH (n:db_Lifelike)
        WHERE n.entity_type = row.entity_type
        RETURN n.id AS entity_id, n.name AS entity_name, n.name AS synonym,
            n.data_source AS data_source, n.hyperlink AS hyperlink
        """

    @property
    def mesh_global_inclusion_exist(self):
        return """
        WITH $values AS row
        OPTIONAL MATCH (n:db_MESH)-[:HAS_SYNONYM]->(s)
        WHERE n.id = 'MESH:' + row.entity_id AND s.name = row.synonym
        RETURN s IS NOT NULL AS exist
        """

    @property
    def gene_global_inclusion_exist(self):
        return """
        WITH $values AS row
        OPTIONAL MATCH (n:Gene)-[:HAS_SYNONYM]->(s)
        WHERE n.id = row.entity_id AND s.name = row.synonym
        RETURN s IS NOT NULL AS exist
        """

    @property
    def protein_global_inclusion_exist(self):
        return """
        WITH $values AS row
        OPTIONAL MATCH (n:db_UniProt)-[:HAS_SYNONYM]->(s)
        WHERE n.id = row.entity_id AND s.name = row.synonym
        RETURN s IS NOT NULL AS exist
        """

    @property
    def species_global_inclusion_exist(self):
        return """
        WITH $values AS row
        OPTIONAL MATCH (n:Taxonomy)-[:HAS_SYNONYM]->(s)
        WHERE n.id = row.entity_id AND s.name = row.synonym
        RETURN s IS NOT NULL AS exist
        """

    @property
    def ***ARANGO_DB_NAME***_global_inclusion_exist(self):
        return """
        WITH $values AS row
        OPTIONAL MATCH (n:db_Lifelike)-[:HAS_SYNONYM]->(s)
        WHERE n.external_id = row.entity_id AND n.data_source = row.data_source
        AND s.name = row.synonym
        RETURN s IS NOT NULL AS exist
        """

    @property
    def create_mesh_global_inclusion(self):
        return """
        WITH $values AS row
        MATCH (n:db_MESH) WHERE n.id = 'MESH:' + row.entity_id
        SET n.entity_type = row.entity_type,
            n.inclusion_date = apoc.date.parseAsZonedDateTime(row.inclusion_date),
            n.user = row.user
        MERGE (s: Synonym {name: row.synonym})
        MERGE (n)-[r:HAS_SYNONYM]->(s)
        SET r.inclusion_date = n.inclusion_date, r.user = n.user
        """

    @property
    def create_gene_global_inclusion(self):
        return """
        WITH $values AS row
        MATCH (n:Gene) WHERE n.id = row.entity_id
        SET n.inclusion_date = apoc.date.parseAsZonedDateTime(row.inclusion_date),
            n.user = row.user
        MERGE (s: Synonym {name: row.synonym})
        MERGE (n)-[r:HAS_SYNONYM]->(s)
        SET r.inclusion_date = n.inclusion_date, r.user = n.user
        """

    @property
    def create_species_global_inclusion(self):
        return """
        WITH $values AS row
        MATCH (n:Taxonomy) WHERE n.id = row.entity_id
        SET n.entity_type = row.entity_type,
            n.inclusion_date = apoc.date.parseAsZonedDateTime(row.inclusion_date),
            n.user = row.user
        MERGE (s:Synonym {name: row.synonym})
        MERGE (n)-[r:HAS_SYNONYM]->(s)
        SET r.inclusion_date = n.inclusion_date, r.user = n.user
        """

    @property
    def create_protein_global_inclusion(self):
        return """
        WITH $values AS row
        MATCH (n:db_UniProt) WHERE n.id = row.entity_id
        SET n.inclusion_date = apoc.date.parseAsZonedDateTime(row.inclusion_date),
            n.user = row.user
        MERGE (s: Synonym {name: row.synonym})
        MERGE (n)-[r:HAS_SYNONYM]->(s)
        SET r.inclusion_date = n.inclusion_date, r.user = n.user
        """

    @property
    def create_***ARANGO_DB_NAME***_global_inclusion(self):
        return """
        WITH $values AS row
        MERGE (n:db_Lifelike {id:row.data_source + ':' + row.entity_id})
        SET n.data_source = row.data_source, n.external_id = row.entity_id,
            n.name = row.common_name, n.entity_type = row.entity_type, n.hyperlink = row.hyperlink,
            n.inclusion_date = apoc.date.parseAsZonedDateTime(row.inclusion_date),
            n.user = row.user
        MERGE (s: Synonym {name: row.synonym})
        MERGE (n)-[r:HAS_SYNONYM]->(s)
        SET r.inclusion_date = n.inclusion_date, r.user = n.user
        """
