from enum import Enum

from neo4japp.constants import ANNOTATION_STYLES_DICT


# lmdb database names
CHEMICALS_CHEBI_LMDB = 'chemicals_chebi'
COMPOUNDS_BIOCYC_LMDB = 'compounds_biocyc'
DISEASES_MESH_LMDB = 'diseases_mesh'
GENES_NCBI_LMDB = 'genes_ncbi'
PHENOTYPES_MESH_LMDB = 'phenotypes_mesh'
PROTEINS_UNIPROT_LMDB = 'proteins_uniprot'
CHEMICALS_PUBCHEM_LMDB = 'chemicals_pubchem'
SPECIES_NCBI_LMDB = 'species_ncbi'

# NLP endpoint
NLP_ENDPOINT = 'http://nlpapi:5001/infer/v1'

LOWERCASE_FIRST_LETTER_UPPERCASE_LAST_LETTER_GENE_LENGTH = 4
PDF_NEW_LINE_THRESHOLD = .30
PDF_CHARACTER_SPACING_THRESHOLD = .325
COMMON_TWO_LETTER_WORDS = {
    'of', 'to', 'in', 'it', 'is', 'be', 'as', 'at',
    'so', 'we', 'he', 'by', 'or', 'on', 'do', 'if',
    'me', 'my', 'up', 'an', 'go', 'no', 'us', 'am',
    'et', 'vs',
}
COMMON_THREE_LETTER_WORDS = {
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all',
    'any', 'can', 'had', 'her', 'was', 'one', 'our', 'out',
    'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new',
    'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did',
    'its', 'let', 'put', 'say', 'she', 'too', 'use', 'end',
    'min', 'far', 'set', 'key', 'tag', 'pdf', 'raw', 'low',
    'med', 'men', 'led', 'add',
}
COMMON_FOUR_LETTER_WORDS = {
    'that', 'with', 'have', 'this', 'will', 'your', 'from',
    'name', 'they', 'know', 'want', 'been', 'good', 'much',
    'some', 'time', 'none', 'link', 'bond', 'acid', 'role',
    'them',
}

COMMON_MISC_WORDS = {
    'patch', 'membrane', 'walker', 'group', 'cluster',
    'protein', 'transporter', 'toxin', 'molecule', 'vitamin',
    'light', 'mixture', 'solution', 'other', 'unknown', 'damage',
}

COMMON_WORDS = set.union(*[
    COMMON_TWO_LETTER_WORDS,
    COMMON_THREE_LETTER_WORDS,
    COMMON_FOUR_LETTER_WORDS,
    COMMON_MISC_WORDS,
])

CHEMICAL_EXCLUSION = {'aa', 'same'}
COMPOUND_EXCLUSION = {'aa', 'same'}  # should this be the same as chemical?
SPECIES_EXCLUSION = {'collection', 'covid-19', 'covid19', 'artificial', 'aa', 'pigs', 'electron'}

# utf-32 unicode
# can search these up here: https://www.fileformat.info/info/unicode/index.htm
MISC_SYMBOLS_AND_CHARS = {8211, 160, 8220, 8221, 8216, 8217, 183, 61623}

COMMON_TYPOS = {
    'Multiple Mitochondrial Dysfunctions Syndromes': ['Multiple Mitochondrial Dysfunctions Syndrome'],  # noqa
    'S-Phase kinase associated protein 2': ['S-Phase kinase-associated protein 2'],
}

LIGATURES = {
    64256: 'ff',
    64257: 'fi',
    64258: 'fl',
    64259: 'ffi',
    64260: 'ffl',
}


class EntityType(Enum):
    Chemical = 'Chemical'
    Compound = 'Compound'
    Disease = 'Disease'
    Gene = 'Gene'
    Protein = 'Protein'
    Species = 'Species'
    Phenotype = 'Phenotype'


ENTITY_TYPE_PRECEDENCE = {
    # larger value takes precedence
    EntityType.Chemical.value: 3,
    EntityType.Compound.value: 2,
    EntityType.Disease.value: 1,
    EntityType.Gene.value: 6,
    EntityType.Protein.value: 5,
    EntityType.Species.value: 7,
    EntityType.Phenotype.value: 4,
}

HOMO_SAPIENS_TAX_ID = '9606'


class OrganismCategory(Enum):
    Archaea = 'Archaea'
    Bacteria = 'Bacteria'
    Eukaryota = 'Eukaryota'
    Viruses = 'Viruses'
    Uncategorized = 'Uncategorized'


class EntityColor(Enum):
    Chemical = ANNOTATION_STYLES_DICT['chemical']['color']
    Compound = ANNOTATION_STYLES_DICT['compound']['color']
    Disease = ANNOTATION_STYLES_DICT['disease']['color']
    Gene = ANNOTATION_STYLES_DICT['gene']['color']
    Protein = ANNOTATION_STYLES_DICT['protein']['color']
    Species = ANNOTATION_STYLES_DICT['species']['color']
    Phenotype = ANNOTATION_STYLES_DICT['phenotype']['color']


class EntityIdStr(Enum):
    Chemical = 'chemical_id'
    Compound = 'compound_id'
    Disease = 'disease_id'
    Gene = 'gene_id'
    Protein = 'protein_id'
    Species = 'tax_id'
    Phenotype = 'phenotype_id'


class DatabaseType(Enum):
    Chebi = 'CHEBI'
    Mesh = 'MESH'
    Uniprot = 'UNIPROT'
    Ncbi = 'NCBI'
    Biocyc = 'BIOCYC'


class AnnotationMethod(Enum):
    NLP = 'NLP'
    Rules = 'Rules Based'


# these links are used in annotations and custom annotations
# first are search links
# then entity hyperlinks
NCBI_LINK = 'https://www.ncbi.nlm.nih.gov/gene/?query='
UNIPROT_LINK = 'https://www.uniprot.org/uniprot/?sort=score&query='
WIKIPEDIA_LINK = 'https://www.google.com/search?q=site:+wikipedia.org+'
GOOGLE_LINK = 'https://www.google.com/search?q='
ENTITY_HYPERLINKS = {
    DatabaseType.Chebi.value: 'https://www.ebi.ac.uk/chebi/searchId.do?chebiId=',
    DatabaseType.Mesh.value: 'https://www.ncbi.nlm.nih.gov/mesh/',
    DatabaseType.Uniprot.value: 'https://www.uniprot.org/uniprot/?sort=score&query=',
    DatabaseType.Ncbi.value: {
        EntityType.Gene.value: 'https://www.ncbi.nlm.nih.gov/gene/',
        EntityType.Species.value: 'https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=',
    },
    DatabaseType.Biocyc.value: 'https://biocyc.org/compound?orgid=META&id=',
}
