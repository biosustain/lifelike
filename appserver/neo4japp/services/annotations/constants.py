from enum import Enum

from neo4japp.constants import ANNOTATION_STYLES_DICT


# lmdb database names
ANATOMY_MESH_LMDB = 'anatomy_mesh'
CHEMICALS_CHEBI_LMDB = 'chemicals_chebi'
CHEMICALS_PUBCHEM_LMDB = 'chemicals_pubchem'
COMPOUNDS_BIOCYC_LMDB = 'compounds_biocyc'
DISEASES_MESH_LMDB = 'diseases_mesh'
FOODS_MESH_LMDB = 'foods_mesh'
GENES_NCBI_LMDB = 'genes_ncbi'
PHENOTYPES_MESH_LMDB = 'phenotypes_mesh'
PROTEINS_UNIPROT_LMDB = 'proteins_uniprot'
SPECIES_NCBI_LMDB = 'species_ncbi'

# NLP endpoint
NLP_ENDPOINT = 'http://nlpapi:5001/infer/v1'

HOMO_SAPIENS_TAX_ID = '9606'

ORGANISM_DISTANCE_THRESHOLD = 200
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
    'them', 'even', 'same',
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

SPECIES_EXCLUSION = {'collection', 'covid-19', 'covid19', 'artificial', 'pigs', 'electron'}

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
    ANATOMY = 'Anatomy'
    CHEMICAL = 'Chemical'
    COMPOUND = 'Compound'
    DISEASE = 'Disease'
    FOOD = 'Food'
    GENE = 'Gene'
    PHENOTYPE = 'Phenotype'
    PROTEIN = 'Protein'
    SPECIES = 'Species'


ENTITY_TYPE_PRECEDENCE = {
    # larger value takes precedence
    EntityType.SPECIES.value: 9,
    EntityType.GENE.value: 8,
    EntityType.PROTEIN.value: 7,
    EntityType.PHENOTYPE.value: 6,
    EntityType.ANATOMY.value: 5,
    EntityType.CHEMICAL.value: 4,
    EntityType.COMPOUND.value: 3,
    EntityType.DISEASE.value: 2,
    EntityType.FOOD.value: 1,
}


class OrganismCategory(Enum):
    ARCHAEA = 'Archaea'
    BACTERIA = 'Bacteria'
    EUKARYOTA = 'Eukaryota'
    VIRUSES = 'Viruses'
    UNCATEGORIZED = 'Uncategorized'


class EntityColor(Enum):
    ANATOMY = ANNOTATION_STYLES_DICT['anatomy']['color']
    CHEMICAL = ANNOTATION_STYLES_DICT['chemical']['color']
    COMPOUND = ANNOTATION_STYLES_DICT['compound']['color']
    DISEASE = ANNOTATION_STYLES_DICT['disease']['color']
    FOOD = ANNOTATION_STYLES_DICT['food']['color']
    GENE = ANNOTATION_STYLES_DICT['gene']['color']
    PHENOTYPE = ANNOTATION_STYLES_DICT['phenotype']['color']
    PROTEIN = ANNOTATION_STYLES_DICT['protein']['color']
    SPECIES = ANNOTATION_STYLES_DICT['species']['color']


class EntityIdStr(Enum):
    ANATOMY = 'anatomy_id'
    CHEMICAL = 'chemical_id'
    COMPOUND = 'compound_id'
    DISEASE = 'disease_id'
    FOOD = 'food_id'
    GENE = 'gene_id'
    PHENOTYPE = 'phenotype_id'
    PROTEIN = 'protein_id'
    SPECIES = 'tax_id'


class DatabaseType(Enum):
    CHEBI = 'CHEBI'
    CUSTOM = 'CUSTOM'
    MESH = 'MESH'
    UNIPROT = 'UNIPROT'
    NCBI = 'NCBI'
    BIOCYC = 'BIOCYC'


class AnnotationMethod(Enum):
    NLP = 'NLP'
    RULES = 'Rules Based'


class ManualAnnotationType(Enum):
    INCLUSION = 'inclusion'
    EXCLUSION = 'exclusion'


# these links are used in annotations and custom annotations
# first are search links
# then entity hyperlinks
SEARCH_LINKS = {
    'ncbi': 'https://www.ncbi.nlm.nih.gov/gene/?term=',
    'uniprot': 'https://www.uniprot.org/uniprot/?sort=score&query=',
    'mesh': 'https://www.ncbi.nlm.nih.gov/mesh/?term=',
    'chebi': 'https://www.google.com/search?q=site:ebi.ac.uk/+',
    'pubchem': 'https://www.google.com/search?q=site:ncbi.nlm.nih.gov/+',
    'wikipedia': 'https://www.google.com/search?q=site:+wikipedia.org+',
    'google': 'https://www.google.com/search?q=',
}
ENTITY_HYPERLINKS = {
    DatabaseType.CHEBI.value: 'https://www.ebi.ac.uk/chebi/searchId.do?chebiId=',
    DatabaseType.MESH.value: 'https://www.ncbi.nlm.nih.gov/mesh/',
    DatabaseType.UNIPROT.value: 'https://www.uniprot.org/uniprot/?sort=score&query=',
    DatabaseType.NCBI.value: {
        EntityType.GENE.value: 'https://www.ncbi.nlm.nih.gov/gene/',
        EntityType.SPECIES.value: 'https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=',
    },
    DatabaseType.BIOCYC.value: 'https://biocyc.org/compound?orgid=META&id=',
    DatabaseType.CUSTOM.value: SEARCH_LINKS['google'],
}
