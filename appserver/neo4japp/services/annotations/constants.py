import re
from enum import Enum
import os
from string import punctuation

from neo4japp.constants import Enumd

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
PDF_NEW_LINE_THRESHOLD = 0.30
PDF_CHARACTER_SPACING_THRESHOLD = 0.325

ABBREVIATION_WORD_LENGTH = {3, 4}
MAX_ABBREVIATION_WORD_LENGTH = 4
MAX_ENTITY_WORD_LENGTH = 6
MIN_ENTITY_LENGTH = 2
MAX_GENE_WORD_LENGTH = 1
MAX_FOOD_WORD_LENGTH = 4

COMMON_TWO_LETTER_WORDS = {
    'of',
    'to',
    'in',
    'it',
    'is',
    'be',
    'as',
    'at',
    'so',
    'we',
    'he',
    'by',
    'or',
    'on',
    'do',
    'if',
    'me',
    'my',
    'up',
    'an',
    'go',
    'no',
    'us',
    'am',
    'et',
    'vs',
}

COMMON_THREE_LETTER_WORDS = {
    'the',
    'and',
    'for',
    'are',
    'but',
    'not',
    'you',
    'all',
    'any',
    'can',
    'had',
    'her',
    'was',
    'one',
    'our',
    'out',
    'day',
    'get',
    'has',
    'him',
    'his',
    'how',
    'man',
    'new',
    'now',
    'old',
    'see',
    'two',
    'way',
    'who',
    'boy',
    'did',
    'its',
    'let',
    'put',
    'say',
    'she',
    'too',
    'use',
    'end',
    'min',
    'far',
    'set',
    'key',
    'tag',
    'pdf',
    'raw',
    'low',
    'med',
    'men',
    'led',
    'add',
}

COMMON_FOUR_LETTER_WORDS = {
    'that',
    'with',
    'have',
    'this',
    'will',
    'your',
    'from',
    'name',
    'they',
    'know',
    'want',
    'been',
    'good',
    'much',
    'some',
    'time',
    'none',
    'link',
    'bond',
    'acid',
    'role',
    'them',
    'even',
    'same',
}

COMMON_MISC_WORDS = {
    'patch',
    'membrane',
    'walker',
    'group',
    'cluster',
    'protein',
    'transporter',
    'toxin',
    'molecule',
    'vitamin',
    'light',
    'mixture',
    'solution',
    'other',
    'unknown',
    'damage',
}

COMMON_WORDS = set.union(
    *[
        COMMON_TWO_LETTER_WORDS,
        COMMON_THREE_LETTER_WORDS,
        COMMON_FOUR_LETTER_WORDS,
        COMMON_MISC_WORDS,
    ]
)


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
