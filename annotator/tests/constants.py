# Arango vars

DOCUMENT_COLLECTIONS = [
        'biocyc',
        'chebi',
        'enzyme',
        'go',
        'kegg',
        '***ARANGO_DB_NAME***',
        'liquibasechangelog',
        'literature',
        'mesh',
        'ncbi',
        'other',
        'pubmed',
        'regulondb',
        'string',
        'synonym',
        'taxonomy',
        'uniprot'
    ]

EDGE_COLLECTIONS = [
    'associated',
    'binds',
    'catalyzes',
    'chebi_link',
    'component_of',
    'consumed_by',
    'element_of',
    'encodes',
    'ends_during',
    'enzyme_link',
    'go_link',
    'happens_during',
    'has_association',
    'has_author',
    'has_functional_parent',
    'has_gene',
    'has_ko',
    'has_ortholog',
    'has_parent',
    'has_parent_hydride',
    'has_part',
    'has_pathway',
    'has_role',
    'has_synonym',
    'has_taxonomy',
    'has_treenumber',
    'has_type',
    'in_changelog',
    'in_pathway',
    'in_pub',
    'indicates',
    'is',
    'is_a',
    'is_conjugate_acid_of',
    'is_conjugate_base_of',
    'is_enantiomer_of',
    'is_substituent_group_from',
    'is_tautomer_of',
    'mapped_to',
    'mapped_to_descriptor',
    'modified_to',
    'negatively_regulates',
    'produces',
    'regulates',
    'replaced_by',
    'type_of'
]

GRAPHS = [
    'all'
]