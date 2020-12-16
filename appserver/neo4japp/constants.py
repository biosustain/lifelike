import os
from datetime import timezone

TIMEZONE = timezone.utc

# Start BioCyc, Regulon, Ecocyc, GO Dataset
TYPE_GENE = 'Gene'
TYPE_PATHWAY = 'Pathway'
TYPE_PROTEIN = 'Protein'
TYPE_ENZREACTION = 'EnzReaction'
TYPE_REACTION = 'Reaction'
TYPE_CHEMICAL = 'Chemical'
TYPE_COMPOUND = 'Compound'
TYPE_BIOLOGICAL_PROCESS = 'BiologicalProcess'
TYPE_CELLULAR_COMPONENT = 'CellularComponent'
TYPE_MOLECULAR_FUNCTION = 'MolecularFunction'

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

DOMAIN_LABELS = [
    'db_CHEBI',
    'db_GO',
    'db_Literature',
    'db_MESH',
    'db_NCBI',
    'db_UniProt',
]

BIOCYC_ORG_ID_DICT = {'9606': 'HUMAN', '511145': 'ECOLI', '559292': 'YEAST'}


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
    TYPE_BIOLOGICAL_PROCESS: 'name',
    TYPE_CELLULAR_COMPONENT: 'name',
    TYPE_CHEMICAL: 'name',
    TYPE_DISEASE: 'name',
    TYPE_GENE: 'name',
    TYPE_MOLECULAR_FUNCTION: 'name',
    TYPE_PUBLICATION: 'title',  # NOTE: These tend to be long, might want to use a different attribute or consider truncating on the client  # noqa
    TYPE_SNIPPET: 'sentence',  # NOTE: Same here
    TYPE_TAXONOMY: 'name',
    TYPE_PROTEIN: 'name',
}

# Start Text Mining Dataset

GRAPH_INDEX = 'graph'


def is_db_name(s: str):
    """check if a str is db name"""
    return s in [DB_CHEBI, DB_NCBI, DB_GO] or s.lower().endswith('cyc')


ANNOTATION_STYLES_DICT = {
    'gene': {
        'color': '#673ab7',
        'label': 'gene',
    },
    'disease': {
        'color': '#ff9800',
        'label': 'disease',
    },
    'chemical': {
        'color': '#4caf50',
        'label': 'chemical',
    },
    'compound': {
        'color': '#4caf50',
        'label': 'compound',
    },
    'mutation': {
        'color': '#5d4037',
        'label': 'mutation',
    },
    'species': {
        'color': '#0277bd',
        'label': 'species',
    },
    'company': {
        'color': '#d62728',
        'label': 'company',
    },
    'study': {
        'color': '#17becf',
        'label': 'study',
    },
    'protein': {
        'color': '#bcbd22',
        'label': 'protein',
    },
    'pathway': {
        'color': '#e377c2',
        'label': 'pathway',
    },
    'phenotype': {
        'color': '#edc949',
        'label': 'phenotype',
    },
    'food': {
        'color': '#8eff69',
        'label': 'food',
    },
    'anatomy': {
        'color': '#0202bd',
        'label': 'anatomy',
    },
    'entity': {
        'label': 'ENTITY',
        'color': '#7f7f7f'
    },
    'lab strain': {
        'color': '#f71698',
        'label': 'lab strain',
    },
    'lab sample': {
        'color': '#f71698',
        'label': 'lab sample',
    },
    'link': {
        'label': 'link',
        'color': '#669999'
    },
    'map': {
        'label': 'map',
        'color': '#0277BD'
    },
    'note': {
        'label': 'note',
        'color': '#EDC949'
    },
    # Non - Entity Types
    'correlation': {
        'label': 'correlation',
        'color': '#d7d9f8'
    },
    'label': {
        'label': 'cause',
        'color': '#d7d9f8'
    },
    'effect': {
        'label': 'effect',
        'color': '#d7d9f8'
    },
    'observation': {
        'label': 'observation',
        'color': '#d7d9f8'
    },
    'association': {
        'label': 'association',
        'color': '#d7d9f8'
    },
    'species': {
        'color': '#0277bd',
        'label': 'species',
    },
    'phentotype': {
        'color': '#edc949',
        'label': 'phentotype',
    },
    # KG Types that are NOT annotation types
    'biologicalprocess': {
        'color': '#eb4034',
        'label': 'biologicalprocess'
    },
    'cellularcomponent': {
        'color': '#34ebd3',
        'label': 'biologicalprocess'
    },
    'molecularfunction': {
        'color': '#eb34dc',
        'label': 'biologicalprocess'
    },
    'taxonomy': {
        'color': '#0277bd',
        'label': 'taxonomy',
    },
}

# Start shared Elastic constants
FILE_INDEX_ID = os.environ['ELASTIC_FILE_INDEX_ID']
FRAGMENT_SIZE = 2147483647
