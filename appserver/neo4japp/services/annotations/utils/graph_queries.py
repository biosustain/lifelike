from neo4japp.exceptions import InvalidArgument

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
    EntityType.PHENOTYPE.value: 'Phenotype',
    EntityType.CHEMICAL.value: 'Chemical',
    EntityType.COMPOUND.value: 'Compound',
    EntityType.GENE.value: 'Gene',
    EntityType.SPECIES.value: 'Taxonomy',
    EntityType.PROTEIN.value: 'Protein',
    EntityType.PATHWAY.value: 'Pathway',
    EntityType.ENTITY.value: 'Entity',
    EntityType.COMPANY.value: 'Company',
    EntityType.LAB_SAMPLE.value: 'LabSample',
    EntityType.LAB_STRAIN.value: 'LabStrain'
}


collection_labels = {
    EntityType.ANATOMY.value: 'mesh',
    EntityType.DISEASE.value: 'mesh',
    EntityType.FOOD.value: 'mesh',
    EntityType.PHENOMENA.value: 'mesh',
    EntityType.PHENOTYPE.value: 'mesh',
    EntityType.CHEMICAL.value: 'chebi',
    EntityType.COMPOUND.value: 'biocyc',
    EntityType.GENE.value: 'ncbi',
    EntityType.SPECIES.value: 'taxonomy',
    EntityType.PROTEIN.value: 'uniprot',
    EntityType.PATHWAY.value: 'kegg',
    EntityType.ENTITY.value: '***ARANGO_DB_NAME***',
    EntityType.COMPANY.value: '***ARANGO_DB_NAME***',
    # TODO: Not sure which collection in which to find these documents...
    # EntityType.LAB_SAMPLE.value: 'LabSample',
    # EntityType.LAB_STRAIN.value: 'LabStrain'
}


def query_builder(parts):
    return '\n'.join(parts)


def get_organisms_from_gene_ids_query():
    return """
    FOR doc IN ncbi
        FILTER 'Gene' IN doc.labels
        FILTER doc.eid IN @gene_ids
        FOR v IN 1..1 OUTBOUND doc has_taxonomy
            RETURN {
                'gene_id': doc.eid,
                'gene_name': doc.name,
                'taxonomy_id': v.eid,
                'species_name': v.name
            }
    """


def get_gene_to_organism_query():
    return """
    FOR s IN synonym
        FILTER s.name IN @genes
        FOR g, synonym_rel IN 1..1 INBOUND s has_synonym
            FILTER 'Gene' IN g.labels
            FOR t, species_rel IN 1..2 OUTBOUND g GRAPH "all" OPTIONS {vertexCollections: 'taxonomy'}
                FILTER t.eid IN @organisms
                FILTER species_rel.label IN ['has_taxonomy', 'has_parent']
                RETURN DISTINCT {
                    'gene_name': g.name,
                    'gene_synonym': s.name,
                    'gene_id': g.eid,
                    'organism_id': t.eid,
                    'data_source': g.data_source
                }
    """


def get_protein_to_organism_query():
    return """
    FOR s IN synonym
        FILTER s.name IN @proteins
        FOR p, synonym_rel IN 1..1 INBOUND s has_synonym OPTIONS {vertexCollections: 'uniprot'}
            FILTER 'Protein' IN p.labels
            FILTER synonym_rel.label == 'has_synonym'
            FOR t, species_rel IN 1..2 OUTBOUND p GRAPH "all" OPTIONS {vertexCollections: 'taxonomy'}
                FILTER t.eid IN @organisms
                FILTER species_rel.label IN ['has_taxonomy', 'has_parent']
                COLLECT organism = t.eid, protein = s.name INTO protein_ids
                RETURN {
                    'protein': protein,
                    'protein_ids': protein_ids[*].p.eid,
                    'organism_id': organism,
                }
    """


def get_global_inclusions_count_query():
    return """
    RETURN {
        'total': COUNT(
            FOR doc IN synonym
                FILTER 'GlobalInclusion' in doc.labels
                FOR v, e IN 1..1 INBOUND doc has_synonym
                    FILTER e.global_inclusion == true
                    FILTER e.inclusion_date != null
                    SORT e.inclusion_date DESC
                    RETURN e.inclusion_date
        )
    }
    """


def get_global_inclusions_query():
    return """
    FOR doc IN synonym
        FILTER 'GlobalInclusion' IN doc.labels
        FOR v, e IN 1..1 INBOUND doc has_synonym
            FILTER e.label == 'has_synonym' AND e.global_inclusion == true AND e.inclusion_date != null
            SORT LOWER(doc.name)
            RETURN {
                'node_internal_id': v._key,
                'syn_node_internal_id': doc._key,
                'entity_id': v.eid,
                'synonym': doc.name,
                'data_source': v.data_source,
                'entity_type': e.entity_type,
                'file_reference': e.file_reference,
                'creator': e.user,
                'creation_date': e.inclusion_date
            }
    """


def get_global_inclusions_paginated_query():
    return """
    FOR doc IN synonym
        FILTER 'GlobalInclusion' IN doc.labels
        FOR v, e IN 1..1 INBOUND doc has_synonym
            FILTER e.label == 'has_synonym' AND e.global_inclusion == true AND e.inclusion_date != null
            SORT LOWER(doc.name) ASC
            LIMIT @skip, @limit
            RETURN {
                'node_internal_id': v._key,
                'syn_node_internal_id': doc._key,
                'entity_id': v.eid,
                'synonym': doc.name,
                'data_source': v.data_source,
                'entity_type': e.entity_type,
                'file_reference': e.file_reference,
                'creator': e.user,
                'creation_date': e.inclusion_date
            }
    """


def get_docs_by_ids_query(entity_type):
    try:
        collection = collection_labels[entity_type]
    except KeyError:
        raise InvalidArgument(
            f'Could not query for document with entity type: {entity_type}. No '
            'collection exists for this type.'
        )

    return f"""
    FOR doc IN {collection}
    FILTER doc.eid IN @ids
    RETURN {{'entity_id': doc.eid, 'entity_name': doc.name}}
    """


# NOTE DEPRECATED: just used in old migration
def get_mesh_by_ids():
    return """
    MATCH (n:db_MESH:TopicalDescriptor) WHERE n.eid IN $ids
    RETURN n.eid AS mesh_id, n.name AS mesh_name
    """


def get_node_labels_and_relationship_query():
    return """
    MATCH (n)-[r:HAS_SYNONYM]-()
    WHERE id(n) IN $node_ids AND exists(n.original_entity_types)
    RETURN id(n) AS node_id, n.eid AS entity_id,
        [l IN labels(n) WHERE NOT l starts WITH 'db_' AND
            NOT l IN [
                'TopicalDescriptor',
                'TreeNumber',
                'BioCycClass',
                'GlobalInclusion',
                'Complex']
            ] AS node_labels,
        n.original_entity_types AS valid_entity_types,
        collect(DISTINCT r.entity_type) AS rel_entity_types
    """


def get_delete_global_inclusion_query():
    return """
    UNWIND $node_ids AS node_ids
    MATCH (s)-[r:HAS_SYNONYM]-(n)
    WHERE id(n) = node_ids[0] AND id(s) = node_ids[1]
    DELETE r
    WITH s
    MATCH (s)-[r:HAS_SYNONYM]-()
    WHERE r.global_inclusion = true AND exists(r.inclusion_date)
    WITH s, collect(r) AS synonym_rel
    CALL apoc.do.when(
        size(synonym_rel) = 0,
        'REMOVE s:GlobalInclusion', '', {synonym_rel: synonym_rel, s:s}
    )
    YIELD value
    RETURN COUNT(*)
    """


def get_global_inclusions_by_type_query(entity_type):
    if entity_type not in node_labels:
        return ''

    query_label = node_labels[entity_type]

    if entity_type in source_labels:
        query_label = f'{source_labels[entity_type]}:{query_label}'

    return f"""
    MATCH (s:GlobalInclusion:Synonym)-[r:HAS_SYNONYM]-(n:{query_label})
    WHERE r.global_inclusion = true AND exists(r.inclusion_date)
    RETURN
        id(n) AS internal_id,
        n.eid AS entity_id,
        n.name AS entity_name,
        n.data_source AS data_source,
        s.name AS synonym,
        r.hyperlinks AS hyperlinks
    """


def get_***ARANGO_DB_NAME***_global_inclusions_by_type_query(entity_type):
    if entity_type not in node_labels:
        return ''

    query_label = node_labels[entity_type]
    if entity_type == EntityType.SPECIES.value:
        query_label = 'Organism'

    return f"""
    MATCH (s:GlobalInclusion:Synonym)-[r:HAS_SYNONYM]-(n:db_Lifelike:{query_label})
    RETURN
        id(n) AS internal_id,
        n.eid AS entity_id,
        n.name AS entity_name,
        n.data_source AS data_source,
        s.name AS synonym,
        r.hyperlinks AS hyperlinks
    """


def get_mesh_global_inclusion_exist_query(entity_type):
    if entity_type not in node_labels:
        return ''

    query_label = node_labels[entity_type]
    return f"""
    OPTIONAL MATCH (n:db_MESH)-[:HAS_SYNONYM]->(s)
    WHERE n.eid = $entity_id
    RETURN n IS NOT NULL AS node_exist,
        '{query_label}' IN labels(n) AS node_has_entity_label,
        $synonym IN collect(s.name) AS synonym_exist
    """


def get_chemical_global_inclusion_exist_query():
    return """
    OPTIONAL MATCH (n:db_CHEBI:Chemical)-[:HAS_SYNONYM]->(s)
    WHERE n.eid = $entity_id
    RETURN n IS NOT NULL AS node_exist,
        $synonym IN collect(s.name) AS synonym_exist
    """


def get_compound_global_inclusion_exist_query():
    return """
    OPTIONAL MATCH (n:db_BioCyc:Compound)-[:HAS_SYNONYM]->(s)
    WHERE n.eid = $entity_id
    RETURN n IS NOT NULL AS node_exist,
        $synonym IN collect(s.name) AS synonym_exist
    """


def get_gene_global_inclusion_exist_query():
    return """
    OPTIONAL MATCH (n:Gene)-[:HAS_SYNONYM]->(s)
    WHERE n.eid = $entity_id
    RETURN n IS NOT NULL AS node_exist,
        $synonym IN collect(s.name) AS synonym_exist
    """


def get_pathway_global_inclusion_exist_query():
    return """
    OPTIONAL MATCH (n:Pathway)-[:HAS_SYNONYM]->(s)
    WHERE n.eid = $entity_id
    RETURN n IS NOT NULL AS node_exist,
        $synonym IN collect(s.name) AS synonym_exist
    """


def get_protein_global_inclusion_exist_query():
    return """
    OPTIONAL MATCH (n:db_UniProt:Protein)-[:HAS_SYNONYM]->(s)
    WHERE n.eid = $entity_id
    RETURN n IS NOT NULL AS node_exist,
        $synonym IN collect(s.name) AS synonym_exist
    """


def get_species_global_inclusion_exist_query():
    return """
    OPTIONAL MATCH (n:db_NCBI:Taxonomy)-[:HAS_SYNONYM]->(s)
    WHERE n.eid = $entity_id
    RETURN n IS NOT NULL AS node_exist,
        $synonym IN collect(s.name) AS synonym_exist
    """


def get_***ARANGO_DB_NAME***_global_inclusion_exist_query(entity_type):
    if entity_type not in node_labels:
        return ''

    query_label = node_labels[entity_type]
    return f"""
    OPTIONAL MATCH (n:db_Lifelike:{query_label})-[r:HAS_SYNONYM]->(s)
    WHERE n.name = $common_name AND r.entity_type = $entity_type
    RETURN n IS NOT NULL AS node_exist,
        $synonym IN collect(s.name) OR
        CASE WHEN
            n IS NOT NULL THEN NOT 'NULL_' IN n.eid
        ELSE false END AS synonym_exist
    """


def get_create_mesh_global_inclusion_query(entity_type):
    if entity_type not in node_labels:
        return ''

    query_label = node_labels[entity_type]
    return """
    MATCH (n:db_MESH) WHERE n.eid = $entity_id
    SET n:replace_with_param
    MERGE (s: Synonym {name: $synonym})
    SET s:GlobalInclusion, s.lowercase_name = toLower($synonym)
    MERGE (n)-[r:HAS_SYNONYM]->(s)
    ON CREATE
    SET r.inclusion_date = apoc.date.parseAsZonedDateTime($inclusion_date),
        r.global_inclusion = true,
        r.user = $user,
        r.file_reference = $file_uuid,
        r.entity_type = $entity_type,
        r.hyperlinks = $hyperlinks
    """.replace('replace_with_param', query_label)


def get_create_chemical_global_inclusion_query():
    return """
    MATCH (n:db_CHEBI:Chemical) WHERE n.eid = $entity_id
    MERGE (s:Synonym {name: $synonym})
    SET s:GlobalInclusion, s.lowercase_name = toLower($synonym)
    MERGE (n)-[r:HAS_SYNONYM]->(s)
    ON CREATE
    SET r.inclusion_date = apoc.date.parseAsZonedDateTime($inclusion_date),
        r.global_inclusion = true,
        r.user = $user,
        r.file_reference = $file_uuid,
        r.entity_type = 'Chemical',
        r.hyperlinks = $hyperlinks
    """


def get_create_compound_global_inclusion_query():
    return """
    MATCH (n:db_BioCyc:Compound) WHERE n.eid = $entity_id
    MERGE (s:Synonym {name: $synonym})
    SET s:GlobalInclusion, s.lowercase_name = toLower($synonym)
    MERGE (n)-[r:HAS_SYNONYM]->(s)
    ON CREATE
    SET r.inclusion_date = apoc.date.parseAsZonedDateTime($inclusion_date),
        r.global_inclusion = true,
        r.user = $user,
        r.file_reference = $file_uuid,
        r.entity_type = 'Compound',
        r.hyperlinks = $hyperlinks
    """


def get_create_gene_global_inclusion_query():
    return """
    MATCH (n:Gene) WHERE n.eid = $entity_id
    MERGE (s:Synonym {name: $synonym})
    SET s:GlobalInclusion, s.lowercase_name = toLower($synonym)
    MERGE (n)-[r:HAS_SYNONYM]->(s)
    ON CREATE
    SET r.inclusion_date = apoc.date.parseAsZonedDateTime($inclusion_date),
        r.global_inclusion = true,
        r.user = $user,
        r.file_reference = $file_uuid,
        r.entity_type = 'Gene',
        r.hyperlinks = $hyperlinks
    """


def get_create_species_global_inclusion_query():
    return """
    MATCH (n:db_NCBI:Taxonomy) WHERE n.eid = $entity_id
    MERGE (s:Synonym {name: $synonym})
    SET s:GlobalInclusion, s.lowercase_name = toLower($synonym)
    MERGE (n)-[r:HAS_SYNONYM]->(s)
    ON CREATE
    SET r.inclusion_date = apoc.date.parseAsZonedDateTime($inclusion_date),
        r.global_inclusion = true,
        r.user = $user,
        r.file_reference = $file_uuid,
        r.entity_type = 'Species',
        r.hyperlinks = $hyperlinks
    """


def get_create_protein_global_inclusion_query():
    return """
    MATCH (n:db_UniProt:Protein) WHERE n.eid = $entity_id
    MERGE (s:Synonym {name: $synonym})
    SET s:GlobalInclusion, s.lowercase_name = toLower($synonym)
    MERGE (n)-[r:HAS_SYNONYM]->(s)
    ON CREATE
    SET r.inclusion_date = apoc.date.parseAsZonedDateTime($inclusion_date),
        r.global_inclusion = true,
        r.user = $user,
        r.file_reference = $file_uuid,
        r.entity_type = 'Protein',
        r.hyperlinks = $hyperlinks
    """


def get_create_***ARANGO_DB_NAME***_global_inclusion_query(entity_type):
    if entity_type not in node_labels:
        return ''

    query_label = node_labels[entity_type]
    if entity_type == EntityType.SPECIES.value:
        query_label = 'Organism'

    # NOTE: a new gene should not be created, because
    # we have no option to specify an organism relationship
    # rather a new synonym of an existing gene can be created
    # so no need to add a :Master Gene label

    return """
    MERGE (n:db_Lifelike {name: $common_name})
    ON CREATE
    SET n.eid = $entity_id,
        n:GlobalInclusion:replace_with_param,
        n.data_source = $data_source,
        n.name = $common_name
    WITH n
    MERGE (s:Synonym {name: $synonym})
    SET s:GlobalInclusion, s.lowercase_name = toLower($synonym)
    MERGE (n)-[r:HAS_SYNONYM]->(s)
    ON CREATE
    SET r.inclusion_date = apoc.date.parseAsZonedDateTime($inclusion_date),
        r.global_inclusion = true,
        r.user = $user,
        r.file_reference = $file_uuid,
        r.entity_type = $entity_type,
        r.hyperlinks = $hyperlinks
    """.replace('replace_with_param', query_label)
