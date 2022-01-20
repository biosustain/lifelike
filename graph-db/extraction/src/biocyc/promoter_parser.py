from biocyc.base_data_file_parser import BaseDataFileParser
from common.constants import *


PROP_TRANS_DIRECTION = 'transcription_direction'
ATTR_NAMES = {
    'UNIQUE-ID': (PROP_BIOCYC_ID, 'str'),
    'COMMON-NAME': (PROP_NAME, 'str'),
    'ABSOLUTE-PLUS-1-POS': (PROP_POS_1, 'str'),
    'TRANSCRIPTION-DIRECTION': (PROP_STRAND, 'str'),
    'SYNONYMS': (PROP_SYNONYMS, 'str')
}


class PromoterParser(BaseDataFileParser):
    def __init__(self, prefix: str, db_name: str, tarfile: str, base_dir: str):
        super().__init__(prefix, base_dir, db_name, tarfile, 'promoters.dat', NODE_PROMOTER, ATTR_NAMES)
        self.attrs = [PROP_BIOCYC_ID, PROP_NAME, PROP_POS_1, PROP_STRAND]

    def __str__(self):
        return 'biocyc-promoter'

    def create_synonym_rels(self) -> bool:
        return True
