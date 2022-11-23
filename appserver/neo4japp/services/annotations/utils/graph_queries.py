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
    EntityType.LAB_SAMPLE.value: '***ARANGO_DB_NAME***',
    EntityType.LAB_STRAIN.value: '***ARANGO_DB_NAME***'
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


def get_node_labels_and_relationship_query():
    return """
    // Review Note: The original cypher query was returning no results even without the ID filter,
    // so the AQL is not easily testable.
    FOR doc IN synonym
        FILTER doc._key IN @ids
        FILTER doc.original_entity_types != null
        LET rel_types = (
            FOR v, e IN 1..1 INBOUND doc has_synonym
                RETURN {'rel_entity_types': relTypes}
        )
        RETURN {
            'node_id': doc._key,
            'entity_id': doc.eid,
            'node_labels': doc.labels[
                * FILTER
                CURRENT NOT IN [
                    'TopicalDescriptor',
                    'TreeNumber',
                    'BioCycClass',
                    'GlobalInclusion',
                    'Complex'
                ]
            ],
            'valid_entity_types': doc.original_entity_types,
            'rel_entity_types': rel_types
        }
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


def get_global_inclusions_by_type_query():
    return """
    FOR doc IN synonym
        FILTER 'GlobalInclusion' IN doc.labels
        FOR v, e IN 1..1 INBOUND doc has_synonym OPTIONS { vertexCollections: @collection }
            FILTER e.global_inclusion == true
            FILTER e.inclusion_date != null
            FILTER @entity_type IN v.labels
            RETURN {
                'internal_id': v._key,
                'entity_id': v.eid,
                'entity_name': v.name,
                'data_source': v.data_source,
                'synonym': doc.name,
                'hyperlinks': e.hyperlinks
            }
    """


def get_***ARANGO_DB_NAME***_global_inclusions_by_type_query():
    return """
    FOR doc IN synonym
        FILTER 'GlobalInclusion' IN doc.labels
        FOR v, e IN 1..1 INBOUND doc has_synonym OPTIONS { vertexCollections: '***ARANGO_DB_NAME***' }
            FILTER e.label == 'has_synonym'
            FILTER @entity_type IN v.labels
            SORT v._key ASC
            RETURN {
                'internal_id': v._key,
                'entity_id': v.eid,
                'entity_name': v.name,
                'data_source': v.data_source,
                'synonym': doc.name,
                'hyperlinks': e.hyperlinks
            }
    """


def get_mesh_global_inclusion_exist_query():
    return f"""
    LET meshGlobalInclusion = FIRST(
        FOR doc IN mesh
            FILTER doc.eid == @eid
            RETURN doc
    )
    LET synonymWithName = FIRST(
        FOR doc IN synonym
            FILTER doc.name == @synonym_name
            RETURN doc
    )
    LET inclusionToSynonymRel = FIRST(
        FOR rel IN has_synonym
            FILTER rel._from == meshGlobalInclusion._id
            FILTER rel._to == synonymWithName._id
            RETURN rel
    )
    RETURN {{
        'node_exist': meshGlobalInclusion != NULL,
        'synonym_exist': synonymWithName != NULL AND inclusionToSynonymRel != NULL,
        'node_has_entity_label': @entity_type IN meshGlobalInclusion.labels
    }}
    """


def get_chemical_global_inclusion_exist_query():
    return """
    LET chebiGlobalInclusion = FIRST(
        FOR doc IN chebi
            FILTER 'Chemical' IN doc.labels
            FILTER doc.eid == @eid
            RETURN doc
    )
    LET synonymWithName = FIRST(
        FOR doc IN synonym
            FILTER doc.name == @synonym_name
            RETURN doc
    )
    LET inclusionToSynonymRel = FIRST(
        FOR rel IN has_synonym
            FILTER rel._from == chebiGlobalInclusion._id
            FILTER rel._to == synonymWithName._id
            RETURN rel
    )
    RETURN {
        'node_exist': chebiGlobalInclusion != NULL,
        'synonym_exist': synonymWithName != NULL AND inclusionToSynonymRel != NULL
    }
    """


def get_compound_global_inclusion_exist_query():
    return """
    LET biocycGlobalInclusion = FIRST(
        FOR doc IN biocyc
            FILTER 'Compound' IN doc.labels
            FILTER doc.eid == @eid
            RETURN doc
    )
    LET synonymWithName = FIRST(
        FOR doc IN synonym
            FILTER doc.name == @synonym_name
            RETURN doc
    )
    LET inclusionToSynonymRel = FIRST(
        FOR rel IN has_synonym
            FILTER rel._from == biocycGlobalInclusion._id
            FILTER rel._to == synonymWithName._id
            RETURN rel
    )
    RETURN {
        'node_exist': biocycGlobalInclusion != NULL,
        'synonym_exist': synonymWithName != NULL AND inclusionToSynonymRel != NULL
    }
    """


def get_gene_global_inclusion_exist_query():
    return """
    LET res = (
        // Review note: This union may not be necessary if we're strictly expecting either ncbi or biocyc results from this query
        FOR n IN union(
            (
                FOR n1 IN ncbi
                    FILTER n1.eid == @eid
                    // Review note: I had to turn this filter off for it to return results in
                    // the newest db. Same for the one below.
                    // FILTER n1.master == true
                    RETURN n1
            ),
            (
                FOR n2 IN biocyc
                    FILTER n2.eid == @eid
                    // Review note: I had to turn this filter off for it to return results in
                    // the newest db. Same for the one below.
                    // FILTER n2.master == true
                    RETURN n2
            )
        )
            FILTER 'Gene' IN n.labels
            LET synList = (
                FOR v, e IN 1..1 OUTBOUND n has_synonym
                FILTER v.name == @synonym
                RETURN 1
            )
            RETURN {node_exist: true, synonym_exist: length(synList) > 0}
    )
    RETURN length(res) == 0 ? { node_exist: false, synonym_exist: false } : res[0]
    """


def get_pathway_global_inclusion_exist_query():
    return """
    LET res = (
        FOR n IN biocyc
            FILTER n.eid == @eid
            FILTER 'Pathway' IN n.labels
        LET synList = (
            FOR v, e IN 1..1 OUTBOUND n has_synonym
                FILTER v.name == @synonym
                RETURN 1
        )
        RETURN {node_exist: true, synonym_exist: length(synList) > 0}
    )
    RETURN length(res) == 0 ? { node_exist: false, synonym_exist: false } : res[0]
    """


def get_protein_global_inclusion_exist_query():
    return """
    LET res = (
        FOR n IN uniprot
            FILTER n.eid == @eid
            FILTER 'Protein' IN n.labels
        LET synList = (
            FOR v, e IN 1..1 OUTBOUND n has_synonym
                FILTER v.name == @synonym
                RETURN 1
        )
        RETURN {node_exist: true, synonym_exist: length(synList) > 0}
    )
    RETURN length(res) == 0 ? { node_exist: false, synonym_exist: false } : res[0]
    """


def get_species_global_inclusion_exist_query():
    return """
    LET res = (
        FOR n IN taxonomy
            FILTER n.eid == @eid
        LET synList = (
            FOR v, e IN 1..1 OUTBOUND n has_synonym
                FILTER v.name == @synonym
                RETURN 1
        )
        RETURN {node_exist: true, synonym_exist: length(synList) > 0}
    )
    RETURN length(res) == 0 ? { node_exist: false, synonym_exist: false } : res[0]
    """


def get_***ARANGO_DB_NAME***_global_inclusion_exist_query():
    return f"""
    LET res = (
        FOR n IN ***ARANGO_DB_NAME***
            FILTER n.name == @common_name
            FILTER @entity_type IN n.labels
        LET synList = (
            FOR v, e IN 1..1 OUTBOUND n has_synonym
            FILTER v.name == @synonym
            FILTER e.entity_type == @entity_type
            RETURN 1
        )
        RETURN {{node_exist: true, synonym_exist: length(synList) > 0}}
    )
    RETURN length(res) == 0 ? {{ node_exist: false, synonym_exist: false }} : res[0]
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
