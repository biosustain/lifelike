from biocyc.base_data_file_parser import BaseDataFileParser
from common.constants import *


ATTR_NAMES = {
    'UNIQUE-ID': (PROP_BIOCYC_ID, 'str'),
    'LEFT-END-POSITION': (PROP_POS_LEFT, 'str'),
    'RIGHT-END-POSITION': (PROP_POS_RIGHT, 'str'),
}


class TerminatorParser(BaseDataFileParser):
    def __init__(self, prefix: str, db_name: str, tarfile: str, base_dir: str):
        super().__init__(prefix, base_dir, db_name, tarfile, 'terminators.dat', NODE_TERMINATOR,ATTR_NAMES)
        self.attrs = [PROP_BIOCYC_ID, PROP_NAME, PROP_ACCESSION, PROP_POS_LEFT, PROP_POS_RIGHT,PROP_STRAND]

    def __str__(self):
        return 'biocyc-terminator'
