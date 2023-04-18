from ..constants import EntityType


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


def get_gene_to_organism_query():
    return """
    FOR s IN synonym
        FILTER s.name IN @genes
        FOR gene, synonym_rel IN INBOUND s has_synonym
            FILTER 'Gene' IN gene.labels
            LET t = FIRST(
                FOR t IN OUTBOUND gene has_taxonomy
                    FILTER t.eid IN @organisms
                    RETURN t.eid
            )
            LET t_parent = FIRST(
                FOR temp_t IN OUTBOUND gene has_taxonomy
                    FOR parent IN OUTBOUND temp_t has_parent
                        FILTER parent.eid IN @organisms
                        RETURN parent.eid
            )
            LET t_grandparent = FIRST(
                FOR temp_t IN OUTBOUND gene has_taxonomy
                    FOR temp_parent IN OUTBOUND temp_t has_parent
                        FOR grand_parent IN OUTBOUND temp_parent has_parent
                            FILTER grand_parent.eid IN @organisms
                            RETURN grand_parent.eid
            )
            LET organism_to_use = FIRST([t, t_parent, t_grandparent][* FILTER CURRENT != null])
            FILTER organism_to_use != null
            RETURN DISTINCT {
                'gene_name': gene.name,
                'gene_synonym': s.name,
                'gene_id': gene.eid,
                'organism_id': organism_to_use,
                'data_source': gene.data_source
            }
    """


def get_protein_to_organism_query():
    return """
    FOR s IN synonym
        FILTER s.name IN @proteins
        FOR protein IN INBOUND s has_synonym OPTIONS {vertexCollections: 'uniprot'}
            FILTER 'Protein' IN protein.labels
            LET t = FIRST(
                FOR t IN OUTBOUND protein has_taxonomy
                    FILTER t.eid IN @organisms
                    RETURN t.eid
            )
            LET t_parent = FIRST(
                FOR temp_t IN OUTBOUND protein has_taxonomy
                    FOR parent IN OUTBOUND temp_t has_parent
                        FILTER parent.eid IN @organisms
                        RETURN parent.eid
            )
            LET t_grandparent = FIRST(
                FOR temp_t IN OUTBOUND protein has_taxonomy
                    FOR temp_parent IN OUTBOUND temp_t has_parent
                        FOR grand_parent IN OUTBOUND temp_parent has_parent
                            FILTER grand_parent.eid IN @organisms
                            RETURN grand_parent.eid
            )
            LET organism_to_use = FIRST([t, t_parent, t_grandparent][* FILTER CURRENT != null])
            FILTER organism_to_use != null
            COLLECT organism = organism_to_use, protein_name = s.name INTO protein_ids
            RETURN {
                'protein': protein_name,
                'protein_ids': protein_ids[*].protein.eid,
                'organism_id': organism,
            }
    """


def get_global_inclusions_by_type_query():
    return """
    FOR doc IN synonym
        FILTER 'GlobalInclusion' IN doc.labels
        FOR v, e IN 1..1 INBOUND doc has_synonym OPTIONS { vertexCollections: @collection }
            FILTER e.global_inclusion == true
            FILTER e.inclusion_date != null
            // Need the 'OR' clause here since documents in the 'taxonomy' collection don't have
            // any entries in their labels.
            FILTER @entity_type IN v.labels OR LENGTH(v.labels) == 0
            RETURN {
                'internal_id': v._id,
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
            SORT v._id ASC
            RETURN {
                'internal_id': v._id,
                'entity_id': v.eid,
                'entity_name': v.name,
                'data_source': v.data_source,
                'synonym': doc.name,
                'hyperlinks': e.hyperlinks
            }
    """
