from datetime import timezone

TIMEZONE = timezone.utc

# Start BioCyc, Regulon, Ecocyc Dataset
TYPE_GENE = 'Gene'
TYPE_PATHWAY = 'Pathway'
TYPE_PROTEIN = 'Protein'
TYPE_ENZREACTION = 'EnzReaction'
TYPE_REACTION = 'Reaction'
TYPE_CHEMICAL = 'Chemical'
TYPE_COMPOUND = 'Compound'

DB_BIOCYC = 'BioCyc'
DB_NCBI = 'NCBI'
DB_GO = 'GO'
DB_CHEBI = 'CHEBI'

PROP_CHEBI_ID = 'chebi_id'
PROP_BIOCYC_ID = 'biocyc_id'
PROP_COMMON_NAME = 'common_name'

NODE_SPECIES = 'Species'

DB_REGULONDB = 'RegulonDB'
DB_BIOCYC = 'BioCyc'
DB_NCBI = 'NCBI'
DB_CHEBI = 'CHEBI'
DB_GO = 'GO'
DB_EC = 'EC'

# End BioCyc, Regulon, Ecocyc Dataset

# Start Text Mining Dataset

TYPE_ASSOCIATION = 'Association'
TYPE_ASSOCIATION_TYPE = 'AssociationType'
TYPE_CHEMICAL = 'Chemical'
TYPE_DISEASE = 'Disease'
TYPE_GENE = 'Gene'
TYPE_PUBLICATION = 'Publication'
TYPE_SNIPPET = 'Snippet'
TYPE_TAXONOMY = 'Taxonomy'

DISPLAY_NAME_MAP = {
    TYPE_ASSOCIATION: 'description',
    TYPE_ASSOCIATION_TYPE: 'name',
    TYPE_CHEMICAL: 'name',
    TYPE_DISEASE: 'name',
    TYPE_GENE: 'name',
    TYPE_PUBLICATION: 'title',  # NOTE: These tend to be long, might want to use a different attribute or consider truncating on the client  # noqa
    TYPE_SNIPPET: 'sentence',  # NOTE: Same here
    TYPE_TAXONOMY: 'name',
    TYPE_PROTEIN: 'name',
}

# Start Text Mining Dataset

GRAPH_INDEX = 'graph'


def is_db_name(s: str):
    """ check if a str is db name"""
    return s in [DB_CHEBI, DB_NCBI, DB_GO] or s.lower().endswith('cyc')


ANNOTATION_STYLES = [{
        "color": '#673ab7',
        "label": "gene",
    },
    {
        "color": '#ff9800',
        "label": "disease",
    },
    {
        "color": '#4caf50',
        "label": "chemical",
    },
    {
        "color": '#4caf50',
        "label": "compound",
    },
    {
        "color": '#5d4037',
        "label": "mutation",
    },
    {
        "color": '#0277bd',
        "label": "species",
    },
    {
        "color": '#d62728',
        "label": "company",
    },
    {
        "color": '#17becf',
        "label": "study",
    },
    {
        "color": '#bcbd22',
        "label": "protein",
    },
    {
        "color": '#e377c2',
        "label": "pathway",
    },
    {
        "color": '#edc949',
        "label": "phentotype",
    },
    {
        "label": "ENTITY",
        "color": '#7f7f7f'
    },
    {
        "label": "LINK",
        "color": '#7f7f7f'
    },
    # Non - Entity Types
    {
        "label": "correlation",
        "color": '#d7d9f8'
    },
    {
        "label": "cause",
        "color": '#d7d9f8'
    },
    {
        "label": "effect",
        "color": '#d7d9f8'
    },
    {
        "label": "observation",
        "color": '#d7d9f8'
    },
    {
        "label": "association",
        "color": '#d7d9f8'
    },
    {
        "color": '#0277bd',
        "label": "map",
    },
    {
        "color": '#edc949',
        "label": "note",
    },
]

ANNOTATION_STYLES_DICT = {
    "gene": {
        "color": '#673ab7',
        "label": "gene",
    },
    "disease": {
        "color": '#ff9800',
        "label": "disease",
    },
    "chemical": {
        "color": '#4caf50',
        "label": "chemical",
    },
    "compound": {
        "color": '#4caf50',
        "label": "compound",
    },
    "mutation": {
        "color": '#5d4037',
        "label": "mutation",
    },
    "species": {
        "color": '#0277bd',
        "label": "species",
    },
    "company": {
        "color": '#d62728',
        "label": "company",
    },
    "study": {
        "color": '#17becf',
        "label": "study",
    },
    "protein": {
        "color": '#bcbd22',
        "label": "protein",
    },
    "pathway": {
        "color": '#e377c2',
        "label": "pathway",
    },
    "phenotype": {
        "color": '#edc949',
        "label": "phenotype",
    },
    "entity": {
        "label": "ENTITY",
        "color": '#7f7f7f'
    },
    "link": {
        "label": "link",
        "color": '#669999'
    },
    "map": {
        "label": "map",
        "color": '#0277BD'
    },
    "note": {
        "label": "note",
        "color": "#EDC949"
    },
    # Non - Entity Types
    "correlation": {
        "label": "correlation",
        "color": '#d7d9f8'
    },
    "label": {
        "label": "cause",
        "color": '#d7d9f8'
    },
    "effect": {
        "label": "effect",
        "color": '#d7d9f8'
    },
    "observation": {
        "label": "observation",
        "color": '#d7d9f8'
    },
    "association": {
        "label": "association",
        "color": '#d7d9f8'
    },
    "species": {
        "color": '#0277bd',
        "label": "species",
    },
    "phentotype": {
        "color": '#edc949',
        "label": "phentotype",
    },
}
