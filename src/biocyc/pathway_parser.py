from biocyc.base_data_file_parser import BaseDataFileParser
from common.graph_models import *
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s',
                    handlers=[logging.StreamHandler()])

PROP_TRANS_DIRECTION = 'transcription_direction'
ATTR_NAMES = {
    'UNIQUE-ID': (PROP_BIOCYC_ID, 'str'),
    'COMMON-NAME': (PROP_COMMON_NAME, 'str'),
    'SYNONYMS': (PROP_SYNONYMS, 'str')
}
REL_NAMES = {
    'TYPES': RelationshipType(REL_TYPE, 'to', NODE_CLASS, PROP_BIOCYC_ID),
    'REACTION-LIST': RelationshipType(REL_IN_PATHWAY, 'from', NODE_PROTEIN, PROP_BIOCYC_ID),
    'IN-PATHWAY': RelationshipType(REL_IN_PATHWAY, 'to', NODE_PATHWAY, PROP_BIOCYC_ID)
}

class PathwayParser(BaseDataFileParser):
    def __init__(self, db_name, tarfile):
        BaseDataFileParser.__init__(self,  db_name, tarfile, 'pathways.dat', NODE_PATHWAY, ATTR_NAMES, REL_NAMES)
        self.attrs = [PROP_BIOCYC_ID, PROP_COMMON_NAME]

    def create_synonym_rels(self) -> bool:
        return True


