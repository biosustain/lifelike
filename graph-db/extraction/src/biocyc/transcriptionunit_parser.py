from biocyc.base_data_file_parser import BaseDataFileParser
from common.constants import *
from common.graph_models import RelationshipType


PROP_TRANS_DIRECTION = 'transcription_direction'
ATTR_NAMES = {
    'UNIQUE-ID': (PROP_BIOCYC_ID, 'str'),
    'COMMON-NAME': (PROP_NAME, 'str')
}
REL_NAMES = {
    'COMPONENTS': RelationshipType(REL_IS_ELEMENT, 'from', DB_BIOCYC, PROP_BIOCYC_ID)
}


class TranscriptionUnitParser(BaseDataFileParser):
    def __init__(self, prefix: str, db_name: str, tarfile: str, base_dir: str):
        super().__init__(prefix, base_dir, db_name, tarfile, 'transunits.dat', NODE_TRANS_UNIT, ATTR_NAMES, REL_NAMES)
        self.attrs = [PROP_BIOCYC_ID, PROP_NAME]

    def __str__(self):
        return 'biocyc-transcriptionunit'

    # def create_synonym_rels(self) -> bool:
    #     return False
