from biocyc.base_data_file_parser import BaseDataFileParser
from common.graph_models import *
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s',
                    handlers=[logging.StreamHandler()])

PROP_TRANS_DIRECTION = 'transcription_direction'
ATTR_NAMES = {
    'UNIQUE-ID': (PROP_BIOCYC_ID, 'str'),
    'COMMON-NAME': (PROP_COMMON_NAME, 'str'),
    'ABSOLUTE-PLUS-1-POS': (PROP_POS_1, 'str'),
    'TRANSCRIPTION-DIRECTION': (PROP_STRAND, 'str'),
    'SYNONYMS': (PROP_SYNONYMS, 'str')
}
REL_NAMES = {
}

class PromoterParser(BaseDataFileParser):
    def __init__(self, db_name, tarfile):
        BaseDataFileParser.__init__(self,  db_name, tarfile, 'promoters.dat', NODE_PROMOTER,ATTR_NAMES, REL_NAMES)
        self.attrs = [PROP_BIOCYC_ID, PROP_COMMON_NAME, PROP_POS_1, PROP_STRAND]

    def create_synonym_rels(self) -> bool:
        return True



