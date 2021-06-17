from neo4japp.database import GraphConnection

from ..constants import EntityType


class GraphMixin(GraphConnection):
    def __init__(self) -> None:
        super().__init__()
        self.node_labels = {
            EntityType.ANATOMY.value: 'Anatomy',
            EntityType.DISEASE.value: 'Disease',
            EntityType.FOOD.value: 'Food',
            EntityType.PHENOMENA.value: 'Phenomena',
            EntityType.CHEMICAL.value: 'Chemical',
            EntityType.COMPOUND.value: 'Compound',
            EntityType.GENE.value: 'Gene',
            EntityType.SPECIES.value: 'Organism',
            EntityType.PROTEIN.value: 'Protein',
            EntityType.PHENOTYPE.value: 'Phenotype',
            EntityType.ENTITY.value: 'Entity',
            EntityType.COMPANY.value: 'Company'
        }

    def exec_read_query(self, query: str):
        return self.graph.read_transaction(lambda tx: list(tx.run(query)))

    def exec_write_query(self, query: str):
        return self.graph.write_transaction(lambda tx: list(tx.run(query)))

    def exec_read_query_with_params(self, query: str, values: dict):
        return self.graph.read_transaction(lambda tx: list(tx.run(query, values=values)))

    def exec_write_query_with_params(self, query: str, values: dict):
        return self.graph.write_transaction(lambda tx: list(tx.run(query, values=values)))

    # TODO: these two <type>_to_organism queries do not
    # need to change, because when we add to db_Lifelike, we
    # do not know what gene/taxonomy to create a relationship with.
    @property
    def get_gene_to_organism(self):
        return """
        WITH $values AS row
        MATCH (s:Synonym)-[]-(g:db_NCBI:Gene)
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

    def get_mesh_global_inclusions_by_type(self, entity_type):
        if entity_type not in self.node_labels:
            return ''

        query_label = self.node_labels[entity_type]
        return f"""
        WITH $values AS row
        MATCH (s:Synonym)-[r:HAS_SYNONYM]-(n:{query_label})
        WHERE exists(s.global_inclusion) AND exists(r.inclusion_date)
        RETURN n.id AS entity_id, n.name AS entity_name,
            s.name AS synonym, n.data_source AS data_source
        """

    def get_chemical_global_inclusions(self):
        return """
        MATCH (s:Synonym)-[r:HAS_SYNONYM]-(n:db_CHEBI:Chemical)
        WHERE exists(s.global_inclusion) AND exists(r.inclusion_date)
        RETURN n.id AS entity_id, n.name AS entity_name,
            s.name AS synonym, n.data_source AS data_source
        """

    def get_compound_global_inclusions(self):
        return """
        MATCH (s:Synonym)-[r:HAS_SYNONYM]-(n:db_BioCyc:Compound)
        WHERE exists(s.global_inclusion) AND exists(r.inclusion_date)
        RETURN n.id AS entity_id, n.name AS entity_name,
            s.name AS synonym, n.data_source AS data_source
        """

    def get_gene_global_inclusions(self):
        return """
        MATCH (s:Synonym)-[r:HAS_SYNONYM]-(n:db_NCBI:Gene)
        WHERE exists(s.global_inclusion) AND exists(r.inclusion_date)
        RETURN n.id AS entity_id, n.name AS entity_name,
            s.name AS synonym, n.data_source AS data_source
        """

    def get_protein_global_inclusions(self):
        return """
        MATCH (s:Synonym)-[r:HAS_SYNONYM]-(n:db_UniProt:Protein)
        WHERE exists(s.global_inclusion) AND exists(r.inclusion_date)
        RETURN n.id AS entity_id, n.name AS entity_name,
            s.name AS synonym, n.data_source AS data_source
        """

    def get_species_global_inclusions(self):
        return """
        MATCH (s:Synonym)-[r:HAS_SYNONYM]-(n:db_NCBI:Taxonomy)
        WHERE exists(s.global_inclusion) AND exists(r.inclusion_date)
        RETURN n.id AS entity_id, n.name AS entity_name,
            s.name AS synonym, n.data_source AS data_source
        """

    def get_***ARANGO_DB_NAME***_global_inclusions_by_type(self, entity_type):
        if entity_type not in self.node_labels:
            return ''

        query_label = self.node_labels[entity_type]
        return f"""
        MATCH (s:Synonym)-[r:HAS_SYNONYM]-(n:db_Lifelike:{query_label})
        RETURN n.id AS entity_id, n.name AS entity_name, s.name AS synonym,
            n.data_source AS data_source, n.hyperlink AS hyperlink
        """

    def mesh_global_inclusion_exist(self, entity_type):
        if entity_type not in self.node_labels:
            return ''

        query_label = self.node_labels[entity_type]
        return f"""
        WITH $values AS row
        OPTIONAL MATCH (n:db_MESH)-[:HAS_SYNONYM]->(s)
        WHERE n.id = 'MESH:' + row.entity_id
        RETURN n IS NOT NULL AS node_exist,
            apoc.coll.contains(labels(n), '{query_label}') AS node_has_entity_label,
            apoc.coll.contains(collect(s.name), row.synonym) AS synonym_exist
        """

    def chemical_global_inclusion_exist(self):
        return """
        WITH $values AS row
        OPTIONAL MATCH (n:db_CHEBI:Chemical)-[:HAS_SYNONYM]->(s)
        WHERE n.id = row.entity_id
        RETURN n IS NOT NULL AS node_exist,
            apoc.coll.contains(collect(s.name), row.synonym) AS synonym_exist
        """

    def compound_global_inclusion_exist(self):
        return """
        WITH $values AS row
        OPTIONAL MATCH (n:db_BioCyc:Compound)-[:HAS_SYNONYM]->(s)
        WHERE n.id = row.entity_id
        RETURN n IS NOT NULL AS node_exist,
            apoc.coll.contains(collect(s.name), row.synonym) AS synonym_exist
        """

    def gene_global_inclusion_exist(self):
        return """
        WITH $values AS row
        OPTIONAL MATCH (n:db_NCBI:Gene)-[:HAS_SYNONYM]->(s)
        WHERE n.id = row.entity_id
        RETURN n IS NOT NULL AS node_exist,
            apoc.coll.contains(collect(s.name), row.synonym) AS synonym_exist
        """

    def protein_global_inclusion_exist(self):
        return """
        WITH $values AS row
        OPTIONAL MATCH (n:db_UniProt:Protein)-[:HAS_SYNONYM]->(s)
        WHERE n.id = row.entity_id
        RETURN n IS NOT NULL AS node_exist,
            apoc.coll.contains(collect(s.name), row.synonym) AS synonym_exist
        """

    def species_global_inclusion_exist(self):
        return """
        WITH $values AS row
        OPTIONAL MATCH (n:db_NCBI:Taxonomy)-[:HAS_SYNONYM]->(s)
        WHERE n.id = row.entity_id
        RETURN n IS NOT NULL AS node_exist,
            apoc.coll.contains(collect(s.name), row.synonym) AS synonym_exist
        """

    def ***ARANGO_DB_NAME***_global_inclusion_exist(self, entity_type):
        if entity_type not in self.node_labels:
            return ''

        query_label = self.node_labels[entity_type]
        return f"""
        WITH $values AS row
        OPTIONAL MATCH (n:db_Lifelike:{query_label})-[:HAS_SYNONYM]->(s)
        WHERE n.external_id = row.entity_id AND n.data_source = row.data_source
        RETURN n IS NOT NULL AS node_exist,
            apoc.coll.contains(collect(s.name), row.synonym) AS synonym_exist
        """

    def create_mesh_global_inclusion(self, entity_type):
        if entity_type not in self.node_labels:
            return ''

        query_label = self.node_labels[entity_type]
        return """
        WITH $values AS row
        MATCH (n:db_MESH) WHERE n.id = 'MESH:' + row.entity_id
        SET n:replace_with_param
        MERGE (s: Synonym {name: row.synonym})
        SET s.global_inclusion = 1, s.need_review = 1
        MERGE (n)-[r:HAS_SYNONYM]->(s)
        SET r.inclusion_date = apoc.date.parseAsZonedDateTime(row.inclusion_date),
            r.user = row.user
        """.replace('replace_with_param', query_label)

    def create_chemical_global_inclusion(self):
        return """
        WITH $values AS row
        MATCH (n:db_CHEBI:Chemical) WHERE n.id = 'CHEBI:' + row.entity_id
        MERGE (s:Synonym {name: row.synonym})
        SET s.global_inclusion = 1, s.need_review = 1
        MERGE (n)-[r:HAS_SYNONYM]->(s)
        SET r.inclusion_date = apoc.date.parseAsZonedDateTime(row.inclusion_date),
            r.user = row.user
        """

    def create_compound_global_inclusion(self):
        return """
        WITH $values AS row
        MATCH (n:db_BioCyc:Compound) WHERE n.id = row.entity_id
        MERGE (s:Synonym {name: row.synonym})
        SET s.global_inclusion = 1, s.need_review = 1
        MERGE (n)-[r:HAS_SYNONYM]->(s)
        SET r.inclusion_date = apoc.date.parseAsZonedDateTime(row.inclusion_date),
            r.user = row.user
        """

    def create_gene_global_inclusion(self):
        return """
        WITH $values AS row
        MATCH (n:db_NCBI:Gene) WHERE n.id = row.entity_id
        MERGE (s:Synonym {name: row.synonym})
        SET s.global_inclusion = 1, s.need_review = 1
        MERGE (n)-[r:HAS_SYNONYM]->(s)
        SET r.inclusion_date = apoc.date.parseAsZonedDateTime(row.inclusion_date),
            r.user = row.user
        """

    def create_species_global_inclusion(self):
        return """
        WITH $values AS row
        MATCH (n:db_NCBI:Taxonomy) WHERE n.id = row.entity_id
        MERGE (s:Synonym {name: row.synonym})
        SET s.global_inclusion = 1, s.need_review = 1
        MERGE (n)-[r:HAS_SYNONYM]->(s)
        SET r.inclusion_date = apoc.date.parseAsZonedDateTime(row.inclusion_date),
            r.user = row.user
        """

    def create_protein_global_inclusion(self):
        return """
        WITH $values AS row
        MATCH (n:db_UniProt:Protein) WHERE n.id = row.entity_id
        MERGE (s:Synonym {name: row.synonym})
        SET s.global_inclusion = 1, s.need_review = 1
        MERGE (n)-[r:HAS_SYNONYM]->(s)
        SET r.inclusion_date = apoc.date.parseAsZonedDateTime(row.inclusion_date),
            r.user = row.user
        """

    def create_***ARANGO_DB_NAME***_global_inclusion(self, entity_type):
        if entity_type not in self.node_labels:
            return ''

        query_label = self.node_labels[entity_type]
        return """
        WITH $values AS row
        MERGE (n:db_Lifelike {id:'Lifelike:' + row.entity_id})
        ON CREATE
        SET n:replace_with_param,
            n.need_review = 1,
            n.data_source = row.data_source,
            n.external_id = row.entity_id,
            n.name = row.common_name,
            n.entity_type = row.entity_type,
            n.hyperlink = row.hyperlink,
            n.inclusion_date = apoc.date.parseAsZonedDateTime(row.inclusion_date),
            n.user = row.user
        WITH n, row
        MERGE (s:Synonym {name: row.synonym})
        SET s.global_inclusion = 1, s.need_review = 1
        MERGE (n)-[r:HAS_SYNONYM]->(s)
        SET r.inclusion_date = n.inclusion_date, r.user = n.user
        """.replace('replace_with_param', query_label)
