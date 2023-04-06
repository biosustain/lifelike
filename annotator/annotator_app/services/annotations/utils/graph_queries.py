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
            FILTER e.label == 'has_synonym'
            FILTER e.global_inclusion == true
            FILTER e.inclusion_date != null
            SORT LOWER(doc.name)
            RETURN {
                'node_internal_id': v._id,
                'syn_node_internal_id': doc._id,
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
            FILTER e.label == 'has_synonym'
            FILTER e.global_inclusion == true
            FILTER e.inclusion_date != null
            SORT LOWER(doc.name) ASC
            LIMIT @skip, @limit
            RETURN {
                'node_internal_id': v._id,
                'syn_node_internal_id': doc._id,
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
        raise ValueError(
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
        FILTER doc._id IN @ids
        FILTER doc.original_entity_types != null
        LET rel_types = (
            FOR v, e IN 1..1 INBOUND doc has_synonym
                RETURN DISTINCT e.entity_type
        )
        RETURN {
            'node_id': doc._id,
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
        FOR id_pair IN @pairs
            LET entity_doc_id = id_pair[0]
            LET synonym_doc_id = id_pair[1]

            // Note that in converting this query from cypher, we've reversed the query: you
            // cannot read from a collection in Arango after deleting from it, so here we get the
            // total count of global relationships first, then delete any between the entity node
            // and the synonym.

            // Get the count of global relationships *before* removing any
            LET prev_global_rels_for_synonym = LENGTH(
                FOR doc IN has_synonym
                    FILTER doc._to == synonym_doc_id
                    FILTER doc.global_inclusion == true
                    FILTER doc.inclusion_date != null
                    RETURN doc
            )

            // Remove the provided relationships, and return how many were removed
            LET num_removed = LENGTH(
                FOR s IN has_synonym
                    FILTER s._from == entity_doc_id
                    FILTER s._to == synonym_doc_id
                    REMOVE s IN has_synonym
                    RETURN s
            )

            // Remove the 'GlobalInclusion' label from the synonym if the previous number of global
            // relationships remaining equals the number we've just removed.
            FILTER prev_global_rels_for_synonym == num_removed
            // Review note: The original query returns the count of the results returned from an
            // apoc call. However, it only does that because it needs to end in a 'RETURN'
            // statement. We don't actually use those values. I'm opting to not return anything in
            // this query, because we don't need to.
            // Another note: shouldn't we delete the synonym if it has no more has_synonym edges?
            // This should be possible if the synonym is purely a global inclusion, so if we don't
            // delete it we could be generating orphaned synonyms. I guess in practice it doesn't
            // really matter, but it's a little smelly.
            FOR doc IN synonym
                FILTER doc._id == synonym_doc_id
                UPDATE doc WITH {labels: REMOVE_VALUE(doc.labels, 'GlobalInclusion')} IN synonym
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


def get_mesh_global_inclusion_exist_query():
    return f"""
    LET meshGlobalInclusion = FIRST(
        FOR doc IN mesh
            FILTER doc.eid == @entity_id
            RETURN doc
    )
    LET synonymWithName = FIRST(
        FOR doc IN synonym
            FILTER doc.name == @synonym
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
            FILTER doc.eid == @entity_id
            RETURN doc
    )
    LET synonymWithName = FIRST(
        FOR doc IN synonym
            FILTER doc.name == @synonym
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
            FILTER doc.eid == @entity_id
            RETURN doc
    )
    LET synonymWithName = FIRST(
        FOR doc IN synonym
            FILTER doc.name == @synonym
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
        // Review note: This union may not be necessary if we're strictly expecting either ncbi or
        // biocyc results from this query
        FOR n IN union(
            (
                FOR n1 IN ncbi
                    FILTER n1.eid == @entity_id
                    FILTER 'Master' IN n1.labels
                    RETURN n1
            ),
            (
                FOR n2 IN biocyc
                    FILTER n2.eid == @entity_id
                    FILTER 'Master' IN n2.labels
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
            FILTER n.eid == @entity_id
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
            FILTER n.eid == @entity_id
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
            FILTER n.eid == @entity_id
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


def get_create_mesh_global_inclusion_query():
    return """
    FOR doc IN mesh
        FILTER doc.eid == @entity_id
        // First, update the mesh document with the new label (it won't be added if it already
        // exists). Note that the subqueries are required because you cannot use the OLD/NEW
        // special variables more than once in a single scope.
        LET m = FIRST(
            UPDATE doc WITH {
                labels: PUSH(doc.labels, @entity_type, true)
            } IN mesh
            RETURN NEW
        )
        // Then, create a synonym with the given name, if one doesn't exist.
        LET s = FIRST(
            UPSERT { name: @synonym }
            INSERT { name: @synonym, lowercase_name: lower(@synonym), labels: ['GlobalInclusion'] }
            UPDATE {
                lowercase_name: lower(@synonym),
                labels: PUSH(OLD.labels, 'GlobalInclusion', true)
            } IN synonym
            RETURN NEW
        )
        // Finally, create a new 'has_synonym' relation if there is none between 'm' and 's'. Note
        // that if 's' was just created, this always inserts a new document. Also, if *ANY*
        // has_synonym exists between 'm' and 's', a new document is *NOT* created and the existing
        // document is *NOT* updated.
        UPSERT {
            _from: m._id,
            _to: s._id,
        }
        // TODO: Write comment regarding existing labels in mesh being used in favor of any new ones
        INSERT {
            _from: m._id,
            _to: s._id,
            label: 'has_synonym',
            inclusion_date: date_format(@inclusion_date, '%z'),
            global_inclusion: true,
            user: @user,
            file_reference: @file_uuid,
            entity_type: @entity_type,
            hyperlinks: @hyperlinks
        }
        UPDATE OLD IN has_synonym
    """


def get_create_chemical_global_inclusion_query():
    return """
    FOR c IN chebi
        FILTER c.eid == @entity_id
        FILTER 'Chemical' IN c.labels
        // First, create a synonym with the given name, if one doesn't exist. Note that the
        // subquery is required because you cannot use the OLD/NEW special variables more than
        // once in a single scope.
        LET s = FIRST(
            UPSERT { name: @synonym }
            INSERT { name: @synonym, lowercase_name: lower(@synonym), labels: ['GlobalInclusion'] }
            UPDATE {
                lowercase_name: lower(@synonym),
                labels: PUSH(OLD.labels, 'GlobalInclusion', true)
            } IN synonym
            RETURN NEW
        )
        // Finally, create a new 'has_synonym' relation if there is none between 'm' and 's'. Note
        // that if 's' was just created, this always inserts a new document. Also, if *ANY*
        // has_synonym exists between 'm' and 's', a new document is *NOT* created and the existing
        // document is *NOT* updated.
        UPSERT {
            _from: c._id,
            _to: s._id,
        }
        INSERT {
            _from: c._id,
            _to: s._id,
            label: 'has_synonym',
            inclusion_date: date_format(@inclusion_date, '%z'),
            global_inclusion: true,
            user: @user,
            file_reference: @file_uuid,
            entity_type: 'Chemical',
            hyperlinks: @hyperlinks
        }
        UPDATE OLD IN has_synonym
    """


def get_create_compound_global_inclusion_query():
    return """
    FOR b IN biocyc
        FILTER b.eid == @entity_id
        FILTER 'Compound' IN b.labels
        // First, create a synonym with the given name, if one doesn't exist. Note that the
        // subquery is required because you cannot use the OLD/NEW special variables more than
        // once in a single scope.
        LET s = FIRST(
            UPSERT { name: @synonym }
            INSERT { name: @synonym, lowercase_name: lower(@synonym), labels: ['GlobalInclusion'] }
            UPDATE {
                lowercase_name: lower(@synonym),
                labels: PUSH(OLD.labels, 'GlobalInclusion', true)
            } IN synonym
            RETURN NEW
        )
        // Finally, create a new 'has_synonym' relation if there is none between 'm' and 's'. Note
        // that if 's' was just created, this always inserts a new document. Also, if *ANY*
        // has_synonym exists between 'm' and 's', a new document is *NOT* created and the existing
        // document is *NOT* updated.
        UPSERT {
            _from: b._id,
            _to: s._id,
        }
        INSERT {
            _from: b._id,
            _to: s._id,
            label: 'has_synonym',
            inclusion_date: date_format(@inclusion_date, '%z'),
            global_inclusion: true,
            user: @user,
            file_reference: @file_uuid,
            entity_type: 'Compound',
            hyperlinks: @hyperlinks
        }
        UPDATE OLD IN has_synonym
    """


def get_create_gene_global_inclusion_query():
    return """
    FOR g IN UNION (
        (
            FOR g1 IN ncbi
                FILTER g1.eid == @entity_id
                RETURN g1
        ),
        (
            FOR g2 IN biocyc
                FILTER g2.eid == @entity_id
                RETURN g2
        )
    )
        FILTER 'Gene' IN g.labels
        // First, create a synonym with the given name, if one doesn't exist. Note that the
        // subquery is required because you cannot use the OLD/NEW special variables more than
        // once in a single scope.
        LET s = FIRST(
            UPSERT { name: @synonym }
            INSERT { name: @synonym, lowercase_name: lower(@synonym), labels: ['GlobalInclusion'] }
            UPDATE {
                lowercase_name: lower(@synonym),
                labels: PUSH(OLD.labels, 'GlobalInclusion', true)
            } IN synonym
            RETURN NEW
        )
        // Finally, create a new 'has_synonym' relation if there is none between 'm' and 's'. Note
        // that if 's' was just created, this always inserts a new document. Also, if *ANY*
        // has_synonym exists between 'm' and 's', a new document is *NOT* created and the existing
        // document is *NOT* updated.
        UPSERT {
            _from: g._id,
            _to: s._id,
        }
        INSERT {
            _from: g._id,
            _to: s._id,
            label: 'has_synonym',
            inclusion_date: date_format(@inclusion_date, '%z'),
            global_inclusion: true,
            user: @user,
            file_reference: @file_uuid,
            entity_type: 'Gene',
            hyperlinks: @hyperlinks
        }
        UPDATE OLD IN has_synonym
    """


def get_create_species_global_inclusion_query():
    return """
    FOR t IN taxonomy
        FILTER t.eid == @entity_id
        // First, create a synonym with the given name, if one doesn't exist. Note that the
        // subquery is required because you cannot use the OLD/NEW special variables more than
        // once in a single scope.
        LET s = FIRST(
            UPSERT { name: @synonym }
            INSERT { name: @synonym, lowercase_name: lower(@synonym), labels: ['GlobalInclusion'] }
            UPDATE {
                lowercase_name: lower(@synonym),
                labels: PUSH(OLD.labels, 'GlobalInclusion', true)
            } IN synonym
            RETURN NEW
        )
        // Finally, create a new 'has_synonym' relation if there is none between 'm' and 's'. Note
        // that if 's' was just created, this always inserts a new document. Also, if *ANY*
        // has_synonym exists between 'm' and 's', a new document is *NOT* created and the existing
        // document is *NOT* updated.
        UPSERT {
            _from: t._id,
            _to: s._id,
        }
        INSERT {
            _from: t._id,
            _to: s._id,
            label: 'has_synonym',
            inclusion_date: date_format(@inclusion_date, '%z'),
            global_inclusion: true,
            user: @user,
            file_reference: @file_uuid,
            entity_type: 'Species',
            hyperlinks: @hyperlinks
        }
        UPDATE OLD IN has_synonym
    """


def get_create_protein_global_inclusion_query():
    return """
    FOR p IN uniprot
        FILTER p.eid == @entity_id
        FILTER 'Protein' IN p.labels
        // First, create a synonym with the given name, if one doesn't exist. Note that the
        // subquery is required because you cannot use the OLD/NEW special variables more than
        // once in a single scope.
        LET s = FIRST(
            UPSERT { name: @synonym }
            INSERT { name: @synonym, lowercase_name: lower(@synonym), labels: ['GlobalInclusion'] }
            UPDATE {
                lowercase_name: lower(@synonym),
                labels: PUSH(OLD.labels, 'GlobalInclusion', true)
            } IN synonym
            RETURN NEW
        )
        // Finally, create a new 'has_synonym' relation if there is none between 'm' and 's'. Note
        // that if 's' was just created, this always inserts a new document. Also, if *ANY*
        // has_synonym exists between 'm' and 's', a new document is *NOT* created and the existing
        // document is *NOT* updated.
        UPSERT {
            _from: p._id,
            _to: s._id,
        }
        INSERT {
            _from: p._id,
            _to: s._id,
            label: 'has_synonym',
            inclusion_date: date_format(@inclusion_date, '%z'),
            global_inclusion: true,
            user: @user,
            file_reference: @file_uuid,
            entity_type: 'Protein',
            hyperlinks: @hyperlinks
        }
        UPDATE OLD IN has_synonym
    """


def get_create_***ARANGO_DB_NAME***_global_inclusion_query():
    # NOTE: a new gene should not be created, because
    # we have no option to specify an organism relationship
    # rather a new synonym of an existing gene can be created
    # so no need to add a :Master Gene label

    return """
    LET mergedLifelikeDoc = FIRST(
        UPSERT { name: @common_name }
        INSERT {
            name: @common_name,
            eid: @entity_id,
            data_source: @data_source,
            labels: ['GlobalInclusion', @entity_type]
        }
        UPDATE {
            eid: @entity_id,
        } IN ***ARANGO_DB_NAME***
        RETURN NEW
    )
    // First, create a synonym with the given name, if one doesn't exist. Note that the
    // subquery is required because you cannot use the OLD/NEW special variables more than
    // once in a single scope.
    LET s = FIRST(
        UPSERT { name: @synonym }
        INSERT { name: @synonym, lowercase_name: lower(@synonym), labels: ['GlobalInclusion'] }
        UPDATE {
            lowercase_name: lower(@synonym),
            labels: PUSH(OLD.labels, 'GlobalInclusion', true)
        } IN synonym
        RETURN NEW
    )
    // Finally, create a new 'has_synonym' relation if there is none between 'mergedLifelikeDoc'
    // and 's'. Note that if 's' was just created, this always inserts a new document. Also, if
    // *ANY* has_synonym exists between 'mergedLifelikeDoc' and 's', a new document is *NOT*
    // created and the existing document is *NOT* updated.
    UPSERT {
        _from: mergedLifelikeDoc._id,
        _to: s._id,
    }
    INSERT {
        _from: mergedLifelikeDoc._id,
        _to: s._id,
        label: 'has_synonym',
        inclusion_date: date_format(@inclusion_date, '%z'),
        global_inclusion: true,
        user: @user,
        file_reference: @file_uuid,
        entity_type: @entity_type,
        hyperlinks: @hyperlinks
    }
    UPDATE OLD IN has_synonym
    """
