import os
import codecs
import string

from datetime import timezone
from enum import Enum


from sendgrid import SendGridAPIClient


TIMEZONE = timezone.utc

# Start BioCyc, Regulon, Ecocyc, GO Dataset
TYPE_GENE = 'Gene'
TYPE_PATHWAY = 'Pathway'
TYPE_PROTEIN = 'Protein'
TYPE_ENZREACTION = 'EnzReaction'
TYPE_REACTION = 'Reaction'
TYPE_REGULATION = 'Regulation'
TYPE_RNA = 'RNA'
TYPE_CHEMICAL = 'Chemical'
TYPE_COMPOUND = 'Compound'
TYPE_BIOLOGICAL_PROCESS = 'BiologicalProcess'
TYPE_CELLULAR_COMPONENT = 'CellularComponent'
TYPE_MOLECULAR_FUNCTION = 'MolecularFunction'

PROP_CHEBI_ID = 'chebi_id'
PROP_BIOCYC_ID = 'biocyc_id'
PROP_COMMON_NAME = 'common_name'

NODE_SPECIES = 'Species'

# KG labels
DB_REGULONDB = 'RegulonDB'
DB_BIOCYC = 'BioCyc'
DB_NCBI = 'NCBI'
DB_CHEBI = 'CHEBI'
DB_GO = 'GO'
DB_EC = 'EC'

FILE_MIME_TYPE_DIRECTORY = 'vnd.***ARANGO_DB_NAME***.filesystem/directory'
FILE_MIME_TYPE_PDF = 'application/pdf'
FILE_MIME_TYPE_BIOC = 'vnd.***ARANGO_DB_NAME***.document/bioc'
FILE_MIME_TYPE_MAP = 'vnd.***ARANGO_DB_NAME***.document/map'
FILE_MIME_TYPE_SANKEY = 'vnd.***ARANGO_DB_NAME***.document/sankey'
FILE_MIME_TYPE_ENRICHMENT_TABLE = 'vnd.***ARANGO_DB_NAME***.document/enrichment-table'


# enrichment labels
class EnrichmentDomain(Enum):
    UNIPROT = 'UniProt'
    REGULON = 'Regulon'
    STRING = 'String'
    GO = 'GO'
    BIOCYC = 'BioCyc'


class LogEventType(Enum):
    ANNOTATION = 'annotations'
    AUTHENTICATION = 'authentication'
    CONTENT_SEARCH = 'content_search'
    ELASTIC = 'elastic'
    ELASTIC_FAILURE = 'elastic-failure'
    ENRICHMENT = 'enrichment_table'
    FILESYSTEM = 'filesystem'
    KNOWLEDGE_GRAPH = 'knowledge_graph'
    LAST_ACTIVE = 'last_active'
    RESET_PASSWORD = 'reset_password'
    SENTRY_HANDLED = 'handled_exception'
    SENTRY_UNHANDLED = 'unhandled_exception'
    SYSTEM = 'system'
    VISUALIZER = 'visualizer'
    VISUALIZER_SEARCH = 'visualizer_search'


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
TYPE_CLASS = 'Class'
TYPE_DISEASE = 'Disease'
TYPE_DNA_BINDING_SITE = 'DNABindingSite'
TYPE_GENE = 'Gene'
TYPE_GENE_PRODUCT = 'GeneProduct'
TYPE_PUBLICATION = 'Publication'
TYPE_SNIPPET = 'Snippet'
TYPE_TAXONOMY = 'Taxonomy'
TYPE_OPERON = 'Operon'
TYPE_PROMOTER = 'Promoter'
TYPE_PROTEIN = 'Protein'
TYPE_TERMINATOR = 'Terminator'
TYPE_TRANSCRIPTION_FACTOR = 'TranscriptionFactor'
TYPE_TRANSCRIPTION_UNIT = 'TranscriptionUnit'

DISPLAY_NAME_MAP = {
    TYPE_ASSOCIATION: 'description',
    TYPE_ASSOCIATION_TYPE: 'name',
    TYPE_BIOLOGICAL_PROCESS: 'name',
    TYPE_CELLULAR_COMPONENT: 'name',
    TYPE_CHEMICAL: 'name',
    TYPE_CLASS: 'biocyc_id',
    TYPE_COMPOUND: 'name',
    TYPE_DISEASE: 'name',
    TYPE_DNA_BINDING_SITE: 'displayName',
    TYPE_GENE: 'name',
    TYPE_GENE_PRODUCT: 'name',
    TYPE_MOLECULAR_FUNCTION: 'name',
    TYPE_OPERON: 'name',
    TYPE_PATHWAY: 'name',
    TYPE_PROMOTER: 'name',
    TYPE_PROTEIN: 'name',
    TYPE_PUBLICATION: 'title',  # NOTE: These tend to be long, might want to use a different attribute or consider truncating on the client  # noqa
    TYPE_ENZREACTION: 'name',
    TYPE_REACTION: 'name',
    TYPE_REGULATION: 'displayName',
    TYPE_RNA: 'displayName',
    TYPE_SNIPPET: 'sentence',  # NOTE: Same here
    TYPE_TAXONOMY: 'name',
    TYPE_TERMINATOR: 'biocyc_id',
    TYPE_TRANSCRIPTION_FACTOR: 'name',
    TYPE_TRANSCRIPTION_UNIT: 'displayName',
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
        'color': '#3177b8',
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
    'phenomena': {
        'color': '#edc949',
        'label': 'phenomena',
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
        'color': '#7f7f7f',
        'label': 'ENTITY'
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
        'color': '#000000',
        'bgcolor': '#dcf1f1',
        'defaultimagecolor': '#669999'
    },
    'map': {
        'label': 'map',
        'color': '#0277bd',
        'defaultimagecolor': '#0277bd'
    },
    'note': {
        'label': 'note',
        'color': '#000000',
        'bgcolor': '#fff6d5',
        'defaultimagecolor': '#edc949'
    },
    'reaction': {
        'label': 'reaction',
        'color': '#ebb434'
    },
    'enzreaction': {
        'label': 'enzreaction',
        'color': '#b32b7f'
    },
    'geneproduct': {
        'label': 'geneproduct',
        'color': '#eb333d'
    },
    'operon': {
        'label': 'operon',
        'color': '#439641'
    },
    'promoter': {
        'label': 'promoter',
        'color': '#5bc9ca'
    },
    'regulation': {
        'label': 'regulation',
        'color': '#bf5858'
    },
    'rna': {
        'label': 'rna',
        'color': '#5c98d1'
    },
    'transcriptionfactor': {
        'label': 'transcriptionfactor',
        'color': '#ea3cf7'
    },
    'transcriptionunit': {
        'label': 'transcriptionunit',
        'color': '#cccdfb'
    },
    # Non - Entity Types
    'correlation': {
        'label': 'correlation',
        'color': '#d7d9f8'
    },
    'cause': {
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
    'class': {
        'color': '#f1587a',
        'label': 'class'
    },
    'molecularfunction': {
        'color': '#eb34dc',
        'label': 'biologicalprocess'
    },
    'taxonomy': {
        'color': '#0277bd',
        'label': 'taxonomy',
    },
    'terminator': {
        'color': '#e5a731',
        'label': 'terminator'
    }
}

# Style constants
DEFAULT_FONT_SIZE = 14.0
DEFAULT_BORDER_COLOR = '#2B7CE9'
DEFAULT_NODE_WIDTH = 41.25
DEFAULT_NODE_HEIGHT = 27.5
MAX_LINE_WIDTH = 50
BASE_ICON_DISTANCE = 0.5
FONT_SIZE_MULTIPLIER = 0.25
IMAGE_HEIGHT_INCREMENT = 0.23
SCALING_FACTOR = 55
ICON_SIZE = '1'
BORDER_STYLES_DICT = {
    'dashed': 'dashed',
    'dotted': 'dotted',
    # Currently not implemented in Graphviz
    'double-dashed': 'dashed',
    'long-dashed': 'dashed'
}

ARROW_STYLE_DICT = {
    'none': 'none',
    'diamond': 'diamond',
    'arrow': 'normal',
    'square': 'box',
    'circle': 'dot',
    'cross-axis': 'tee',
    # 'none' ensures spacing between the symbols.
    # It is required only for arrows -'normal' type.
    'cross-axis-arrow': 'normalnonetee',
    'double-cross-axis': 'teetee',
    'square-arrow': 'normalnonebox',
    'circle-arrow': 'normalnonedot'
}

# Start shared security constants
MAX_ALLOWED_LOGIN_FAILURES = 5
MIN_TEMP_PASS_LENGTH = 18
MAX_TEMP_PASS_LENGTH = 24
RESET_PASSWORD_SYMBOLS = '!@#$%&()-_=+[]{};:><?'
RESET_PASSWORD_ALPHABET = RESET_PASSWORD_SYMBOLS + string.ascii_letters + string.digits

# Start email constants
MESSAGE_SENDER_IDENTITY = "***ARANGO_DB_NAME***-account-service@***ARANGO_DB_NAME***.bio"
MAILING_API_KEY = os.getenv('SEND_GRID_EMAIL_API_KEY')
RESET_PASSWORD_EMAIL_TITLE = 'Lifelike.bio: Account password reset'
RESET_PASS_MAIL_CONTENT = codecs.open(r'/home/n4j/assets/reset_email.html', "r").read()
SEND_GRID_API_CLIENT = SendGridAPIClient(MAILING_API_KEY)

# Start shared Elastic constants
FILE_INDEX_ID = os.environ['ELASTIC_FILE_INDEX_ID']
FRAGMENT_SIZE = 1024

LIFELIKE_DOMAIN = os.getenv('DOMAIN')
