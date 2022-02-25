from biocyc.base_data_file_parser import BaseDataFileParser
from common.constants import *
from common.graph_models import RelationshipType


ATTR_NAMES = {
    'UNIQUE-ID': (PROP_BIOCYC_ID, 'str'),
    'COMMON-NAME': (PROP_NAME, 'str'),
    'ABBREV-NAME': (PROP_ABBREV_NAME, 'str'),
    'LOCATIONS': (PROP_LOCATION, 'str')
}
REL_NAMES = {
    'TYPES': RelationshipType(REL_TYPE, 'to', NODE_CLASS, PROP_BIOCYC_ID),
    'GENE': RelationshipType(REL_ENCODE, 'from', NODE_GENE, PROP_BIOCYC_ID),
    'MODIFIED-FORM': RelationshipType(REL_MODIFIED_TO, 'to', NODE_RNA, PROP_BIOCYC_ID)
}


class RnaParser(BaseDataFileParser):
    def __init__(self, prefix: str, db_name: str, tarfile: str, base_dir: str):
        super().__init__(prefix, base_dir, db_name, tarfile, 'rnas.dat', NODE_RNA, ATTR_NAMES, REL_NAMES)
        self.attrs = [PROP_BIOCYC_ID, PROP_NAME, PROP_ABBREV_NAME, PROP_LOCATION]

    def __str__(self):
        return 'biocyc-rna'
