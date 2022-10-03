from biocyc.parsers.data_file_parser import DataFileParser
from biocyc.parsers.relationship_types import CITATIONS
from common.constants import *


PROP_POS = 'abs_center_pos'
PROP_LEN = 'site_length'

ATTR_NAMES = {
    'UNIQUE-ID': (PROP_BIOCYC_ID, 'str'),
    'ABS-CENTER-POS': (PROP_POS, 'str'),
    'SITE-LENGTH': (PROP_LEN, 'str')
}

REL_NAMES = CITATIONS


class DnaBindSiteParser(DataFileParser):
    def __init__(self, db_name, tarfile):
        DataFileParser.__init__(
            self,
            db_name, tarfile, 'dnabindsites.dat', NODE_DNA_BINDING_SITE, ATTR_NAMES, REL_NAMES)
        self.attrs = [PROP_BIOCYC_ID, PROP_POS, PROP_LEN]

    def write_synonyms_file(self, nodes, outfile):
        return None

