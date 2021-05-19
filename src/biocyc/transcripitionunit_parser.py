from biocyc.base_data_file_parser import BaseDataFileParser
from common.constants import *
from common.graph_models import *
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s',
                    handlers=[logging.StreamHandler()])

PROP_TRANS_DIRECTION = 'transcription_direction'
ATTR_NAMES = {
    'UNIQUE-ID': (PROP_BIOCYC_ID, 'str'),
    'COMMON-NAME': (PROP_COMMON_NAME, 'str')
}
REL_NAMES = {
    'COMPONENTS': RelationshipType(REL_IS_ELEMENT, 'from', DB_BIOCYC, PROP_BIOCYC_ID)
}


class TranscriptionUnitParser(BaseDataFileParser):
    def __init__(self, db_name, tarfile):
        BaseDataFileParser.__init__(self, db_name, tarfile, 'transunits.dat', NODE_TRANS_UNIT, ATTR_NAMES, REL_NAMES)
        self.attrs = [PROP_BIOCYC_ID, PROP_COMMON_NAME]

    def create_synonym_rels(self) -> bool:
        return False

