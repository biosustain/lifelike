from biocyc.parsers.data_file_parser import DataFileParser
from biocyc.parsers.relationship_types import CITATIONS
from common.graph_models import *


PROP_TRANS_DIRECTION = 'transcription_direction'
ATTR_NAMES = {
    'UNIQUE-ID': (PROP_BIOCYC_ID, 'str'),
    'COMMON-NAME': (PROP_NAME, 'str')
}
REL_NAMES = {
    'COMPONENTS': RelationshipType(REL_IS_ELEMENT, 'from', DB_BIOCYC, PROP_BIOCYC_ID),
    **CITATIONS
}


class TranscriptionUnitParser(DataFileParser):
    def __init__(self, db_name, tarfile):
        DataFileParser.__init__(self, db_name, tarfile, 'transunits.dat', NODE_TRANS_UNIT, ATTR_NAMES, REL_NAMES)
        self.attrs = [PROP_BIOCYC_ID, PROP_NAME, PROP_URL]

    def write_synonyms_file(self, nodes, outfile):
        return None


