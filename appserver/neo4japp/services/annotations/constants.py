import re
from enum import Enum
import os
from string import punctuation

from neo4japp.util import Enumd

# lmdb database names
PDF_NEW_LINE_THRESHOLD = .30

ABBREVIATION_WORD_LENGTH = {3, 4}
MAX_ABBREVIATION_WORD_LENGTH = 4
MAX_ENTITY_WORD_LENGTH = 6
MIN_ENTITY_LENGTH = 2
MAX_GENE_WORD_LENGTH = 1
MAX_FOOD_WORD_LENGTH = 4

REQUEST_TIMEOUT = int(os.getenv('SERVICE_REQUEST_TIMEOUT', '60'))
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


class EntityType(Enumd):
    ANATOMY = 'Anatomy'
    CHEMICAL = 'Chemical'
    COMPOUND = 'Compound'
    DISEASE = 'Disease'
    FOOD = 'Food'
    GENE = 'Gene'
    PATHWAY = 'Pathway'
    PHENOMENA = 'Phenomena'
    PHENOTYPE = 'Phenotype'
    PROTEIN = 'Protein'
    SPECIES = 'Species'

    # non LMDB entity types
    COMPANY = 'Company'
    ENTITY = 'Entity'
    LAB_SAMPLE = 'Lab Sample'
    LAB_STRAIN = 'Lab Strain'


class ManualAnnotationType(Enum):
    INCLUSION = 'inclusion'
    EXCLUSION = 'exclusion'


WORD_CHECK_REGEX = re.compile(r'[\d{}]+$'.format(re.escape(punctuation)))
