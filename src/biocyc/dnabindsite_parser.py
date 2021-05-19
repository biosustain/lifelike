from biocyc.base_data_file_parser import BaseDataFileParser
from common.constants import *
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s',
                    handlers=[logging.StreamHandler()])

PROP_POS = 'abs_center_pos'
PROP_LEN = 'site_length'

ATTR_NAMES = {
    'UNIQUE-ID': (PROP_BIOCYC_ID, 'str'),
    'ABS-CENTER-POS': (PROP_POS, 'str'),
    'SITE-LENGTH': (PROP_LEN, 'str')
}


class DnaBindSiteParser(BaseDataFileParser):
    def __init__(self, db_name, tarfile):
        BaseDataFileParser.__init__(self,  db_name, tarfile, 'dnabindsites.dat', NODE_DNA_BINDING_SITE,ATTR_NAMES, [] )
        self.attrs = [PROP_BIOCYC_ID, PROP_POS, PROP_LEN]

    def create_synonym_rels(self) -> bool:
        return False


