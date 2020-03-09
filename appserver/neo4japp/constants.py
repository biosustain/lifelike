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
TYPE_REFERENCE = 'Reference'
TYPE_TAXONOMY = 'Taxonomy'

DISPLAY_NAME_MAP = {
    TYPE_ASSOCIATION: 'description',
    TYPE_ASSOCIATION_TYPE: 'name',
    TYPE_CHEMICAL: 'name',
    TYPE_DISEASE: 'name',
    TYPE_GENE: 'name',
    TYPE_PUBLICATION: 'title',  # NOTE: These tend to be long, might want to use a different attribute or consider truncating on the client
    TYPE_REFERENCE: 'sentence',  # NOTE: Same here
}

# Start Text Mining Dataset


ELASTICSEARCH_URL = 'http://elasticsearch:9200'
GRAPH_INDEX = 'graph'

def is_db_name(s: str):
    """ check if a str is db name"""
    return s in [DB_CHEBI, DB_NCBI, DB_GO] or s.lower().endswith('cyc')