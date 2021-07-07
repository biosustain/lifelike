from enum import Enum


# lmdb database names
ANATOMY_LMDB = 'anatomy_lmdb'
CHEMICALS_LMDB = 'chemicals_lmdb'
COMPOUNDS_LMDB = 'compounds_lmdb'
DISEASES_LMDB = 'diseases_lmdb'
FOODS_LMDB = 'foods_lmdb'
GENES_LMDB = 'genes_lmdb'
PHENOMENAS_LMDB = 'phenomenas_lmdb'
PHENOTYPES_LMDB = 'phenotypes_lmdb'
PROTEINS_LMDB = 'proteins_lmdb'
SPECIES_LMDB = 'species_lmdb'

HOMO_SAPIENS_TAX_ID = '9606'

ORGANISM_DISTANCE_THRESHOLD = 200
PDF_NEW_LINE_THRESHOLD = .30
PDF_CHARACTER_SPACING_THRESHOLD = .325

ABBREVIATION_WORD_LENGTH = {3, 4}
MAX_ABBREVIATION_WORD_LENGTH = 4
MAX_ENTITY_WORD_LENGTH = 6
MAX_GENE_WORD_LENGTH = 1
MAX_FOOD_WORD_LENGTH = 4

REQUEST_TIMEOUT = 60
NLP_SERVICE_ENDPOINT = 'https://nlp-api.***ARANGO_DB_NAME***.bio/v1/predict'
PARSER_RESOURCE_PULL_ENDPOINT = 'http://appserver:5000/annotations/files'
PARSER_PDF_ENDPOINT = 'http://pdfparser:7600/token/rect/json/'
PARSER_TEXT_ENDPOINT = 'http://pdfparser:7600/token/rect/text/json'

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

# utf-32 unicode
# can search these up here: https://www.fileformat.info/info/unicode/index.htm
MISC_SYMBOLS_AND_CHARS = {8211, 160, 8220, 8221, 8216, 8217, 183, 61623}
GREEK_SYMBOLS = {916, 8710}  # just delta unicodes for now

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
    PHENOMENA = 'Phenomena'
    PHENOTYPE = 'Phenotype'
    PROTEIN = 'Protein'
    SPECIES = 'Species'

    # non LMDB entity types
    COMPANY = 'Company'
    ENTITY = 'Entity'


ENTITY_TYPE_PRECEDENCE = {
    # larger value takes precedence
    EntityType.SPECIES.value: 12,
    EntityType.GENE.value: 11,
    EntityType.PROTEIN.value: 10,
    EntityType.PHENOTYPE.value: 9,
    EntityType.PHENOMENA.value: 8,
    EntityType.CHEMICAL.value: 7,
    EntityType.COMPOUND.value: 6,
    EntityType.DISEASE.value: 5,
    EntityType.ANATOMY.value: 4,
    EntityType.FOOD.value: 3,
    EntityType.COMPANY.value: 2,
    EntityType.ENTITY.value: 1
}


class OrganismCategory(Enum):
    ARCHAEA = 'Archaea'
    BACTERIA = 'Bacteria'
    EUKARYOTA = 'Eukaryota'
    VIRUSES = 'Viruses'
    UNCATEGORIZED = 'Uncategorized'


class EntityIdStr(Enum):
    ANATOMY = 'anatomy_id'
    CHEMICAL = 'chemical_id'
    COMPOUND = 'compound_id'
    DISEASE = 'disease_id'
    FOOD = 'food_id'
    GENE = 'gene_id'
    PHENOMENA = 'phenomena_id'
    PHENOTYPE = 'phenotype_id'
    PROTEIN = 'protein_id'
    SPECIES = 'tax_id'

    # non LMDB entity types
    COMPANY = 'company_id'
    ENTITY = 'entity_id'


class DatabaseType(Enum):
    CHEBI = 'CHEBI'
    CUSTOM = 'CUSTOM'
    MESH = 'MESH'
    UNIPROT = 'UNIPROT'
    NCBI_GENE = 'NCBI Gene'
    NCBI_TAXONOMY = 'NCBI Taxonomy'
    BIOCYC = 'BIOCYC'
    PUBCHEM = 'PUBCHEM'


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
    'chebi': 'https://www.ebi.ac.uk/chebi/advancedSearchFT.do?searchString=',
    'pubchem': 'https://pubchem.ncbi.nlm.nih.gov/#query=',
    'wikipedia': 'https://www.google.com/search?q=site:+wikipedia.org+',
    'google': 'https://www.google.com/search?q=',
}
ENTITY_HYPERLINKS = {
    DatabaseType.CHEBI.value: 'https://www.ebi.ac.uk/chebi/searchId.do?chebiId=',
    DatabaseType.MESH.value: 'https://www.ncbi.nlm.nih.gov/mesh/',
    DatabaseType.UNIPROT.value: 'https://www.uniprot.org/uniprot/?sort=score&query=',
    DatabaseType.NCBI_GENE.value: 'https://www.ncbi.nlm.nih.gov/gene/',
    DatabaseType.NCBI_TAXONOMY.value: 'https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=',  # noqa
    DatabaseType.BIOCYC.value: 'https://biocyc.org/compound?orgid=META&id=',
    DatabaseType.CUSTOM.value: SEARCH_LINKS['google'],
}

DEFAULT_ANNOTATION_CONFIGS = {
    'exclude_references': True,
    'annotation_methods': {
        EntityType.CHEMICAL.value: {'nlp': False, 'rules_based': True},
        EntityType.DISEASE.value: {'nlp': False, 'rules_based': True},
        EntityType.GENE.value: {'nlp': False, 'rules_based': True}
    }
}
