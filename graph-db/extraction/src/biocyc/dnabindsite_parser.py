from biocyc.base_data_file_parser import BaseDataFileParser
from common.constants import *


ATTR_NAMES = {
    'UNIQUE-ID': (PROP_BIOCYC_ID, 'str'),
    'ABS-CENTER-POS': (PROP_POS, 'str'),
    # 'SITE-LENGTH': (PROP_LEN, 'str')
}


class DnaBindSiteParser(BaseDataFileParser):
    def __init__(self, prefix: str, db_name: str, tarfile: str, base_dir: str):
        super().__init__(prefix, base_dir, db_name, tarfile, 'dnabindsites.dat', NODE_DNA_BINDING_SITE, ATTR_NAMES)
        self.attrs = [PROP_BIOCYC_ID, PROP_POS]

    def __str__(self):
        return 'biocyc-dnabindsite'
