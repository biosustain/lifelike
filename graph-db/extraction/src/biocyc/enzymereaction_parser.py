from biocyc.data_file_parser import DataFileParser
from common.graph_models import *


ATTR_NAMES = {
    'UNIQUE-ID': (PROP_BIOCYC_ID, 'str'),
    'COMMON-NAME': (PROP_NAME, 'str'),
    'SYNONYMS': (PROP_SYNONYMS, 'str')
}
REL_NAMES = {
    'ENZYME': RelationshipType(REL_CATALYZE, 'from', NODE.BIOCYC, PROP_BIOCYC_ID),
    'REACTION': RelationshipType(REL_CATALYZE, 'to', NODE.BIOCYC, PROP_BIOCYC_ID),
}


class EnzymeReactionParser(DataFileParser):
    def __init__(self, db_name, tarfile):
        DataFileParser.__init__(self, db_name, tarfile, 'enzrxns.dat', NODE_ENZ_REACTION, ATTR_NAMES, REL_NAMES)
        self.attrs = [PROP_BIOCYC_ID, PROP_NAME, PROP_URL]

    def write_synonyms_file(self, nodes, outfile):
        return None


