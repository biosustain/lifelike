from ..constants import EntityType


source_labels = {
    EntityType.ANATOMY.value: 'db_MESH',
    EntityType.DISEASE.value: 'db_MESH',
    EntityType.FOOD.value: 'db_MESH',
    EntityType.PHENOMENA.value: 'db_MESH',
    EntityType.PHENOTYPE.value: 'db_MESH',
    EntityType.CHEMICAL.value: 'db_CHEBI',
    EntityType.COMPOUND.value: 'db_BioCyc',
    EntityType.GENE.value: 'db_NCBI',
    EntityType.SPECIES.value: 'db_NCBI',
    EntityType.PROTEIN.value: 'db_UniProt'
}

node_labels = {
    EntityType.ANATOMY.value: 'Anatomy',
    EntityType.DISEASE.value: 'Disease',
    EntityType.FOOD.value: 'Food',
    EntityType.PHENOMENA.value: 'Phenomena',
    EntityType.CHEMICAL.value: 'Chemical',
    EntityType.COMPOUND.value: 'Compound',
    EntityType.GENE.value: 'Gene',
    EntityType.SPECIES.value: 'Taxonomy',
    EntityType.PROTEIN.value: 'Protein',
    EntityType.PHENOTYPE.value: 'Phenotype',
    EntityType.ENTITY.value: 'Entity',
    EntityType.COMPANY.value: 'Company'
}


def get_organisms_from_gene_ids():
    return """
    MATCH (g:Gene) WHERE g.id IN $gene_ids
    WITH g
    MATCH (g)-[:HAS_TAXONOMY]-(t:Taxonomy)
    RETURN g.id AS gene_id, g.name as gene_name, t.id as taxonomy_id,
        t.name as species_name
    """


def get_gene_to_organism():
    return """
    MATCH (s:Synonym)-[]-(g:db_NCBI:Gene)
    WHERE s.name IN $genes
    WITH s, g MATCH (g)-[:HAS_TAXONOMY]-(t:Taxonomy)-[:HAS_PARENT*0..2]->(p:Taxonomy)
    WHERE p.id IN $organisms
    RETURN g.name AS gene_name, s.name AS gene_synonym, g.id AS gene_id,
        p.id AS organism_id
    """


def get_protein_to_organism():
    return """
    MATCH (s:Synonym)-[]-(g:db_UniProt)
    WHERE s.name IN $proteins
    WITH s, g MATCH (g)-[:HAS_TAXONOMY]-(t:Taxonomy)-[:HAS_PARENT*0..2]->(p:Taxonomy)
    WHERE p.id IN $organisms
    RETURN s.name AS protein, collect(g.id) AS protein_ids, p.id AS organism_id
    """


def get_nodes_by_ids(entity_type):
    if entity_type not in node_labels:
        return ''

    query_label = node_labels[entity_type]
    if entity_type in source_labels:
        query_label = f'{source_labels[entity_type]}:{query_label}'

    return f"""
    MATCH (n:{query_label}) WHERE n.id IN $ids
    RETURN n.id AS entity_id, n.name AS entity_name
    """


# NOTE DEPRECATED: just used in old migration
def get_mesh_by_ids():
    return """
    MATCH (n:db_MESH:TopicalDescriptor) WHERE n.id IN $ids
    RETURN n.id AS mesh_id, n.name AS mesh_name
    """


def get_global_inclusions_by_type(entity_type):
    if entity_type not in node_labels:
        return ''

    query_label = node_labels[entity_type]

    if entity_type in source_labels:
        query_label = f'{source_labels[entity_type]}:{query_label}'

    return f"""
    MATCH (s:Synonym)-[r:HAS_SYNONYM]-(n:{query_label})
    WHERE exists(s.global_inclusion) AND exists(r.inclusion_date)
    RETURN n.id AS entity_id, n.name AS entity_name,
        s.name AS synonym, n.data_source AS data_source
    """


def get_lifelike_global_inclusions_by_type(entity_type):
    if entity_type not in node_labels:
        return ''

    query_label = node_labels[entity_type]
    if entity_type == EntityType.SPECIES.value:
        query_label = 'Organism'

    return f"""
    MATCH (s:Synonym)-[r:HAS_SYNONYM]-(n:db_Lifelike:{query_label})
    RETURN n.id AS entity_id, n.name AS entity_name, s.name AS synonym,
        n.data_source AS data_source, n.hyperlink AS hyperlink
    """


def mesh_global_inclusion_exist(entity_type):
    if entity_type not in node_labels:
        return ''

    query_label = node_labels[entity_type]
    return f"""
    OPTIONAL MATCH (n:db_MESH)-[:HAS_SYNONYM]->(s)
    WHERE n.id = 'MESH:' + $entity_id
    RETURN n IS NOT NULL AS node_exist,
        '{query_label}' IN labels(n) AS node_has_entity_label,
        $synonym IN collect(s.name) AS synonym_exist
    """


def chemical_global_inclusion_exist():
    return """
    OPTIONAL MATCH (n:db_CHEBI:Chemical)-[:HAS_SYNONYM]->(s)
    WHERE n.id = 'CHEBI:' + $entity_id
    RETURN n IS NOT NULL AS node_exist,
        $synonym IN collect(s.name) AS synonym_exist
    """


def compound_global_inclusion_exist():
    return """
    OPTIONAL MATCH (n:db_BioCyc:Compound)-[:HAS_SYNONYM]->(s)
    WHERE n.id = $entity_id
    RETURN n IS NOT NULL AS node_exist,
        $synonym IN collect(s.name) AS synonym_exist
    """


def gene_global_inclusion_exist():
    return """
    OPTIONAL MATCH (n:db_NCBI:Gene)-[:HAS_SYNONYM]->(s)
    WHERE n.id = $entity_id
    RETURN n IS NOT NULL AS node_exist,
        $synonym IN collect(s.name) AS synonym_exist
    """


def protein_global_inclusion_exist():
    return """
    OPTIONAL MATCH (n:db_UniProt:Protein)-[:HAS_SYNONYM]->(s)
    WHERE n.id = $entity_id
    RETURN n IS NOT NULL AS node_exist,
        $synonym IN collect(s.name) AS synonym_exist
    """


def species_global_inclusion_exist():
    return """
    OPTIONAL MATCH (n:db_NCBI:Taxonomy)-[:HAS_SYNONYM]->(s)
    WHERE n.id = $entity_id
    RETURN n IS NOT NULL AS node_exist,
        $synonym IN collect(s.name) AS synonym_exist
    """


def lifelike_global_inclusion_exist(entity_type):
    if entity_type not in node_labels:
        return ''

    query_label = node_labels[entity_type]
    return f"""
    OPTIONAL MATCH (n:db_Lifelike:{query_label})-[:HAS_SYNONYM]->(s)
    WHERE n.external_id = 'Lifelike:' + $entity_id AND n.data_source = $data_source
    RETURN n IS NOT NULL AS node_exist,
        $synonym IN collect(s.name) AS synonym_exist
    """


def create_mesh_global_inclusion(entity_type):
    if entity_type not in node_labels:
        return ''

    query_label = node_labels[entity_type]
    return """
    MATCH (n:db_MESH) WHERE n.id = 'MESH:' + $entity_id
    SET n:replace_with_param
    MERGE (s: Synonym {name: row.synonym})
    SET s.global_inclusion = 1, s.need_review = 1
    MERGE (n)-[r:HAS_SYNONYM]->(s)
    SET r.inclusion_date = apoc.date.parseAsZonedDateTime($inclusion_date),
        r.user = $user
    """.replace('replace_with_param', query_label)


def create_chemical_global_inclusion():
    return """
    MATCH (n:db_CHEBI:Chemical) WHERE n.id = 'CHEBI:' + $entity_id
    MERGE (s:Synonym {name: $synonym})
    SET s.global_inclusion = 1, s.need_review = 1
    MERGE (n)-[r:HAS_SYNONYM]->(s)
    SET r.inclusion_date = apoc.date.parseAsZonedDateTime($inclusion_date),
        r.user = $user
    """


def create_compound_global_inclusion():
    return """
    MATCH (n:db_BioCyc:Compound) WHERE n.id = $entity_id
    MERGE (s:Synonym {name: $synonym})
    SET s.global_inclusion = 1, s.need_review = 1
    MERGE (n)-[r:HAS_SYNONYM]->(s)
    SET r.inclusion_date = apoc.date.parseAsZonedDateTime($inclusion_date),
        r.user = $user
    """


def create_gene_global_inclusion():
    return """
    MATCH (n:db_NCBI:Gene) WHERE n.id = $entity_id
    MERGE (s:Synonym {name: $synonym})
    SET s.global_inclusion = 1, s.need_review = 1
    MERGE (n)-[r:HAS_SYNONYM]->(s)
    SET r.inclusion_date = apoc.date.parseAsZonedDateTime($inclusion_date),
        r.user = $user
    """


def create_species_global_inclusion():
    return """
    MATCH (n:db_NCBI:Taxonomy) WHERE n.id = $entity_id
    MERGE (s:Synonym {name: $synonym})
    SET s.global_inclusion = 1, s.need_review = 1
    MERGE (n)-[r:HAS_SYNONYM]->(s)
    SET r.inclusion_date = apoc.date.parseAsZonedDateTime($inclusion_date),
        r.user = $user
    """


def create_protein_global_inclusion():
    return """
    MATCH (n:db_UniProt:Protein) WHERE n.id = $entity_id
    MERGE (s:Synonym {name: $synonym})
    SET s.global_inclusion = 1, s.need_review = 1
    MERGE (n)-[r:HAS_SYNONYM]->(s)
    SET r.inclusion_date = apoc.date.parseAsZonedDateTime($inclusion_date),
        r.user = $user
    """


def create_lifelike_global_inclusion(entity_type):
    if entity_type not in node_labels:
        return ''

    query_label = node_labels[entity_type]
    if entity_type == EntityType.SPECIES.value:
        query_label = 'Organism'

    return """
    MERGE (n:db_Lifelike {id:'Lifelike:' + $entity_id})
    ON CREATE
    SET n:replace_with_param,
        n.need_review = 1,
        n.data_source = $data_source,
        n.external_id = $entity_id,
        n.name = $common_name,
        n.entity_type = $entity_type,
        n.hyperlink = $hyperlink,
        n.inclusion_date = apoc.date.parseAsZonedDateTime($inclusion_date),
        n.user = $user
    WITH n
    MERGE (s:Synonym {name: $synonym})
    SET s.global_inclusion = 1, s.need_review = 1
    MERGE (n)-[r:HAS_SYNONYM]->(s)
    SET r.inclusion_date = n.inclusion_date, r.user = n.user
    """.replace('replace_with_param', query_label)
