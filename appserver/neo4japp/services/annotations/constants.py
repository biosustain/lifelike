from enum import Enum

# these links are used in annotations and custom annotations
NCBI_LINK = 'https://ncbi.nlm.nih.gov/gene/?term='
UNIPROT_LINK = 'https://uniprot.org/uniprot/?query='
WIKIPEDIA_LINK = 'https://www.google.com/search?q=site:+wikipedia.org+'
GOOGLE_LINK = 'https://www.google.com/search?q='

PDF_NEW_LINE_THRESHOLD = .30
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
    'med', 'men',
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
}

COMMON_WORDS = set.union(*[
    COMMON_TWO_LETTER_WORDS,
    COMMON_THREE_LETTER_WORDS,
    COMMON_FOUR_LETTER_WORDS,
    COMMON_MISC_WORDS,
])

TYPO_SYNONYMS = {
    # 'e coli': ['E. coli', 'Escherichia coli', 'Enterococcus coli'],
    'multiplemitochondrialdysfunctionssyndromes': ['Multiple Mitochondrial Dysfunctions Syndrome'],  # noqa
}


class EntityColor(Enum):
    Chemicals = '#cee5cb'
    Compounds = '#cee5cb'
    Diseases = '#fae0b8'
    Genes = '#8f7cbf'
    Proteins = '#bcbd22'
    Species = '#3177b8'


class EntityIdStr(Enum):
    Chemicals = 'chemical_id'
    Compounds = 'compound_id'
    Diseases = 'disease_id'
    Genes = 'gene_id'
    Proteins = 'protein_id'
    Species = 'tax_id'


class EntityType(Enum):
    Chemicals = 'Chemicals'
    Compounds = 'Compounds'
    Diseases = 'Diseases'
    Genes = 'Genes'
    Proteins = 'Proteins'
    Species = 'Species'
