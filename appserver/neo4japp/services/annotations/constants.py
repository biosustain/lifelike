from enum import Enum

from neo4japp.constants import ANNOTATION_STYLES_DICT


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
    'light', 'mixture', 'solution', 'other', 'unknown',
    'collection',
}

COMMON_WORDS = set.union(*[
    COMMON_TWO_LETTER_WORDS,
    COMMON_THREE_LETTER_WORDS,
    COMMON_FOUR_LETTER_WORDS,
    COMMON_MISC_WORDS,
])

MISC_SYMBOLS_AND_CHARS = {'(c)'}

TYPO_SYNONYMS = {
    'e coli': ['E. coli', 'Escherichia coli', 'Enterococcus coli'],
    'E.coli': ['E. coli', 'Escherichia coli', 'Enterococcus coli'],
    'Multiple Mitochondrial Dysfunctions Syndromes': ['Multiple Mitochondrial Dysfunctions Syndrome'],  # noqa
}

ENTITY_TYPE_PRECEDENCE = {
    # larger value takes precedence
    'Chemicals': 2,
    'Compounds': 2,
    'Diseases': 1,
    'Genes': 5,
    'Proteins': 3,
    'Species': 6,
    'Phenotypes': 4,
}

HOMO_SAPIENS_TAX_ID = '9606'


class OrganismCategory(Enum):
    Archaea = 'Archaea'
    Bacteria = 'Bacteria'
    Eukaryota = 'Eukaryota'
    Viruses = 'Viruses'
    Uncategorized = 'Uncategorized'


class EntityColor(Enum):
    Chemicals = ANNOTATION_STYLES_DICT['chemical']['color']
    Compounds = ANNOTATION_STYLES_DICT['compound']['color']
    Diseases = ANNOTATION_STYLES_DICT['disease']['color']
    Genes = ANNOTATION_STYLES_DICT['gene']['color']
    Proteins = ANNOTATION_STYLES_DICT['protein']['color']
    Species = ANNOTATION_STYLES_DICT['species']['color']
    Phenotypes = ANNOTATION_STYLES_DICT['phenotype']['color']


class EntityIdStr(Enum):
    Chemicals = 'chemical_id'
    Compounds = 'compound_id'
    Diseases = 'disease_id'
    Genes = 'gene_id'
    Proteins = 'protein_id'
    Species = 'tax_id'
    Phenotypes = 'phenotype_id'


class EntityType(Enum):
    Chemicals = 'Chemicals'
    Compounds = 'Compounds'
    Diseases = 'Diseases'
    Genes = 'Genes'
    Proteins = 'Proteins'
    Species = 'Species'
    Phenotypes = 'Phenotypes'


class DatabaseType(Enum):
    Chebi = 'CHEBI'
    Mesh = 'MESH'
    Uniprot = 'UNIPROT'
    Ncbi = 'NCBI'
    Biocyc = 'BIOCYC'


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
        EntityType.Genes.value: 'https://www.ncbi.nlm.nih.gov/gene/',
        EntityType.Species.value: 'https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=',
    },
    DatabaseType.Biocyc.value: 'https://biocyc.org/compound?orgid=META&id=',
}
