"""NODES"""
NODE_ANATOMY = 'Anatomy'
NODE_ASSOCIATION = 'Association'
# Rename 'Class' to 'BioCycClass'
NODE_CLASS = 'BioCycClass'
NODE_CHEMICAL = 'Chemical'
NODE_COMPOUND = 'Compound'
NODE_COMPLEX = 'Complex'
NODE_DBLINK = 'DBLink'
NODE_DISEASE = 'Disease'
NODE_DNA_BINDING_SITE = 'DNABindingSite'
NODE_EC_NUMBER = 'EC_Number'
NODE_ENZ_REACTION = 'EnzReaction'
NODE_FOOD = 'Food'
NODE_GENE = 'Gene'
NODE_GENOME = 'Genome'
NODE_KO = 'KO'
NODE_LITERATURE_CHEMICAL = 'LiteratureChemical'
NODE_LITERATURE_DISEASE = 'LiteratureDisease'
NODE_LITERATURE_ENTITY = 'LiteratureEntity'
NODE_LITERATURE_GENE = 'LiteratureGene'
NODE_MASTER = 'Master'
NODE_PRODUCT = 'GeneProduct'
NODE_OPERON = 'Operon'
NODE_PATHWAY = 'Pathway'
NODE_PHENOMENA = 'Phenomena'
NODE_PROMOTER = 'Promoter'
NODE_PROTEIN = 'Protein'
NODE_PUBLICATION = 'Publication'
NODE_REACTION = 'Reaction'
NODE_REGULON = 'Regulon'
NODE_REGULATION = 'Regulation'
NODE_RNA = 'RNA'
NODE_SNIPPET = 'Snippet'
NODE_SPECIES = 'Species'
NODE_SYNONYM = 'Synonym'
NODE_TERMINATOR = 'Terminator'
NODE_TRANS_FACTOR = 'TranscriptionFactor'
NODE_TRANS_UNIT = 'TranscriptionUnit'
NODE_TREENUMBER = 'TreeNumber'
NODE_TAXONOMY = 'Taxonomy'
NODE_TOPICALDESC = 'TopicalDescriptor'

DB_REGULONDB = 'RegulonDB'
DB_BIOCYC = 'BioCyc'
DB_ECOCYC = 'EcoCyc'
DB_YEASTCYC = 'YeastCyc'
DB_HUMANCYC = 'HumanCyc'
DB_METACYC = 'MetaCyc'
# DB_PPUT = 'Pput160488cyc'
DB_PPUT = 'PseudomonasCyc'
DB_BSUBCYC = 'BsubCyc'
DB_PAENIBACILLUSCYC = 'PaenibacillusCyc'

DB_ARO = 'ARO'  # antibiotic resistance ontology
DB_NCBI = 'NCBI'
DB_CHEBI = 'CHEBI'
DB_ENZYME = 'Enzyme'
DB_GO = 'GO'
DB_KEGG = 'KEGG'
DB_LITERATURE = 'Literature'
DB_MESH = 'MESH'
DB_PUBMED = 'PubMed'
DB_STRING = 'STRING'
DB_UNIPROT = 'UniProt'

DB_PREFIX = 'db_'
NODE_BIOCYC = DB_PREFIX + DB_BIOCYC
NODB_BSUBCYC = DB_PREFIX + DB_BSUBCYC
NODE_ECOCYC = DB_PREFIX + DB_ECOCYC
NODE_HUMANCYC = DB_PREFIX + DB_HUMANCYC
NODE_YEASTCYC = DB_PREFIX + DB_YEASTCYC
NODE_PPUTCYC = DB_PREFIX + DB_PPUT
NODE_CHEBI = DB_PREFIX + DB_CHEBI
NODE_ENZYME = DB_PREFIX + DB_ENZYME
NODE_GO = DB_PREFIX + DB_GO
NODE_KEGG = DB_PREFIX + DB_KEGG
NODE_MESH = DB_PREFIX + DB_MESH
NODE_NCBI = DB_PREFIX + DB_NCBI
NODE_PUBMED = DB_PREFIX + DB_PUBMED
NODE_REGULONDB = DB_PREFIX + DB_REGULONDB
NODE_STRING = DB_PREFIX + DB_STRING
NODE_UNIPROT = DB_PREFIX + DB_UNIPROT
NODE_LITERATURE = DB_PREFIX + DB_LITERATURE

"""Relationships"""
REL_ACTIVATORS = "HAS_ACTIVATOR"
REL_ALT_ID = 'HAS_ALT_ID'
REL_BIND = 'BINDS'
REL_CATALYZE = 'CATALYZES'
REL_CITATIONS = "HAS_CITATION"
REL_COFACTORS = 'HAS_COFACTOR'
REL_HAS_COMPONENT = "HAS_COMPONENT"
REL_IS_COMPONENT = "COMPONENT_OF"
REL_CONSUMED_BY = 'CONSUMED_BY'
REL_CONTAINS = 'CONTAINS'
REL_DBLINKS = 'HAS_DBLINK'
REL_EC_NUMBER = 'HAS_EC'
REL_HAS_ELEMENT = 'HAS_ELEMENT'
REL_HAS_PATHWAY = 'HAS_PATHWAY'
REL_IS_ELEMENT = 'ELEMENT_OF'
REL_ENCODE = 'ENCODES'
REL_ENZYME = 'HAS_ENZYME'
REL_GO_LINK = 'GO_LINK'
REL_INHIBITORS = "HAS_INHIBITOR"
REL_IS_A = 'IS_A'
REL_IS = 'IS'
REL_MAPPED_TO = 'MAPPED_TO'
REL_MAPPED_TO_DESCRIPTOR = 'MAPPED_TO_DESCRIPTOR'
REL_MEMBERS = "HAS_MEMBER"
REL_MODIFIED_TO = 'MODIFIED_TO'
REL_PRODUCE = 'PRODUCES'
REL_REACTION = 'HAS_REACTION'
REL_REGULATE = 'REGULATES'
REL_REGULATORS = 'IS_REGULATOR_OF'
REL_RELATIONSHIP = 'RELATIONSHIP'
REL_REPLACEDBY = 'REPLACED_BY'
REL_SPECIES = 'HAS_SPECIES'
REL_SYNONYM = 'HAS_SYNONYM'
REL_PARENT = 'HAS_PARENT'
REL_TAXONOMY = 'HAS_TAXONOMY'
REL_TREENUMBER = 'HAS_TREENUMBER'
REL_GENE = 'HAS_GENE'
REL_IN_PATHWAY = "IN_PATHWAY"
REL_TYPE = 'TYPE_OF'

# CHEBI Relationships
REL_PART = 'HAS_PART'
REL_FUNCTIONAL_PARENT = 'HAS_FUNCTIONAL_PARENT'
REL_ROLE = 'HAS_ROLE'
REL_CONJUGATE_BASE_OF = 'IS_CONJUGATE_BASE_OF'
REL_CONJUGATE_ACID_OF = 'IS_CONJUGATE_ACID_OF'
REL_TAUTOMER_OF = 'IS_TAUTOMER_OF'
REL_PARENT_HYDRIDE = 'HAS_PARENT_HYDRIDE'
REL_ENANTIOMER_OF = 'IS_ENANTIOMER_OF'
REL_SUBSTITUENT_GROUP_FROM = 'IS_SUBSTITUENT_GROUP_FROM'


PROP_ACCESSION = 'accession'
PROP_ACCESSION2 = 'accession2'
PROP_ALT_ID = 'alt_id'
PROP_ANNOTATION = 'annotation'
PROP_BIOCYC_ID = 'biocyc_id'
PROP_CHEBI_ID = 'chebi_id'
PROP_ARO_ID = 'aro_id'
PROP_CATEGORY = 'category'
PROP_COMMENT = 'comment'
PROP_COMPARTMENT = 'compartment'
PROP_ABBREV_NAME = 'abbrev_name'
PROP_DATA_SOURCE = 'data_source'
PROP_DB_NAME = 'db_name'
PROP_DEF = 'definition'
PROP_DESCRIPTION = 'description'
PROP_DIRECTION = 'direction'
PROP_EC_NUMBER = 'ec_number'
PROP_FROM_NODE = 'from_node'
PROP_FROM_ID = 'from_id'
PROP_FULLNAME = 'full_name'
PROP_FUNCTION = 'function'  # positive or negative, +/-
PROP_GENE_ID = 'gene_id'
PROP_GENE_NAME = 'gene_name'
PROP_GENOME = 'genome'
PROP_GO_ID = 'go_id'
PROP_ID = 'eid'
PROP_INCHI = 'inchi'
PROP_INCHI_KEY = 'inchi_key'
PROP_INCLUSION_DATE = 'inclusion_date'
PROP_LOCATION = 'location'
PROP_LOCUS_TAG = 'locus_tag'
PROP_LOWERCASE_NAME = 'lowercase_name'
PROP_MECHANISM = 'mechanism'
PROP_MODE = 'mode'
PROP_MOL_WEIGHT_KD = 'molecular_weight_kd'
PROP_NAME = 'name'
PROP_NAMESPACE = 'namespace'
PROP_OBSOLETE = 'obsolete'
PROP_ORG_NAME = 'organism'
PROP_OTHER_NAME = 'other_name'
PROP_PARENT_ID = 'parent_id'
PROP_PATHWAY = 'pathway'
PROP_PI = 'pi'
PROP_POS_LEFT = 'left_end_position'
PROP_POS_RIGHT = 'right_end_position'
PROP_POS_1 = 'pos_1'  # for promoter, transcription start pos
PROP_PROTEIN_SIZE = 'protein_size'
PROP_PUBLICATION_ID = 'pmid'
PROP_RANK = 'rank'
PROP_REF_ID = 'reference_id'
PROP_REFSEQ = 'refseq'
PROP_REGULONDB_ID = 'regulondb_id'
PROP_SCIENTIFIC_NAME = 'scientific_name'
PROP_SEQUENCE = 'sequence'
PROP_DB_SOURCE = 'database_source'
PROP_SMILES = 'smiles'
PROP_STRING_ID = 'string_id'
PROP_STRAIN_NAME = 'strain_name'
PROP_STRAND = 'strand'
PROP_SYMBOL = 'symbol'
PROP_SYNONYMS = 'synonyms'
PROP_TAX_ID = 'tax_id'
PROP_TO_ID = 'to_id'
PROP_TO_NODE = 'to_node'
PROP_TYPE = 'type'
PROP_URL = 'url'

'''Edge properties'''
EDGE_SOURCE = 'source'
EDGE_NAME = 'name'
EDGE_START_POS = 'start_pos'
EDGE_END_POS = 'end_pos'

INDEXED_FIELDS = [PROP_ACCESSION, PROP_ALT_ID, PROP_BIOCYC_ID, PROP_CHEBI_ID, PROP_TAX_ID,
                  PROP_NAME, PROP_EC_NUMBER, PROP_ID, PROP_LOCUS_TAG,
                  PROP_NAME, PROP_SCIENTIFIC_NAME, PROP_SYMBOL, PROP_SYNONYMS]


NODE_ID_INDEX_MAP = {
    DB_GO: 'GO-ID',
    DB_CHEBI: 'MESH-ID',  # to ensure chemical in literature matches either chebi or mesh
    DB_REGULONDB: 'REGULONDB-ID',
    DB_ECOCYC: 'BIOCYC-ID',
    DB_ENZYME: 'Enzyme-ID',
    DB_METACYC: 'BIOCYC-ID',
    DB_MESH: 'MESH-ID',
    DB_UNIPROT: 'UniProt-ID',
    NODE_GENE: 'Gene-ID',
    NODE_SYNONYM: 'Synonym-ID',
    NODE_TAXONOMY: 'Taxonomy-ID',
    NODE_PUBLICATION: 'Publication-ID',
    'NCBI-GENE': 'Gene-ID'
}

# data sources
DS_NCBI_GENE = 'NCBI Gene'
DS_NCBI_TAX = 'NCBI Taxonomy'
DS_UNIPROT = 'UniProt'
DS_CHEBI = 'ChEBI'
DS_MESH = 'MeSH'
DS_BIOCYC = 'BioCyc'


def get_db_label(db_name: str):
    if not db_name.startswith('db_'):
        return 'db_' + db_name
    return db_name

