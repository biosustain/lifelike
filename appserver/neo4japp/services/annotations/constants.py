from enum import Enum

PDF_LOWER_Y_THRESHOLD = .08

COMMON_WORDS = {
    'not', 'the', 'in', 'or', 'and', 'by', 'to',
    'with', 'can', 'for', 'was', 'at', 'if', 'end',
    'be', 'min', 'we', 'link', 'up', 'far', 'set',
    'but', 'as', 'ml', 'it', 'had', 'key', 'did',
    'do', 'It', 'For', 'for', 'tag', 'how', 'old',
    'kit', 'Low', 'an', 'jar', 'PDF', 'raw', 'patch',
    'membrane', 'out', 'et', 'den', 'tor', 'rod', 'Med',
    'Walker', 'Lin', 'Men', 'bond', 'group', 'acid', 'cluster',
    'protein', 'transporter', 'role', 'toxin', 'molecule', 'vitamin', 'us',
    'fit', 'light', 'mixture', 'solution', 'vs', 'this', 'other',
    'none', 'not', 'unknown', 'is', 'no', 'has',
}

TYPO_SYNONYMS = {
    'e coli': ['E. coli', 'Escherichia coli', 'Enterococcus coli'],
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
