from biocyc.base_data_file_parser import BaseDataFileParser
from common.constants import *
from common.graph_models import RelationshipType


ATTR_NAMES = {
    'UNIQUE-ID': (PROP_BIOCYC_ID, 'str'),
    'MODE': (PROP_MODE, 'str'),
    'MECHANISM': (PROP_MECHANISM, 'str'),
}
REL_NAMES = {
    'TYPES': RelationshipType(REL_TYPE, 'to', NODE_CLASS, PROP_BIOCYC_ID),
    'ASSOCIATED-BINDING-SITE': RelationshipType(REL_BIND, 'to', NODE_DNA_BINDING_SITE, PROP_BIOCYC_ID),
    'REGULATOR': RelationshipType(REL_REGULATE, 'from', DB_BIOCYC, PROP_BIOCYC_ID),
    'REGULATED-ENTITY': RelationshipType(REL_REGULATE, 'to', DB_BIOCYC, PROP_BIOCYC_ID)
}

class RegulationParser(BaseDataFileParser):
    def __init__(self, prefix: str, db_name: str, tarfile: str, base_dir: str):
        super().__init__(prefix, base_dir, db_name, tarfile, 'regulation.dat', NODE_REGULATION,ATTR_NAMES, REL_NAMES)
        self.attrs = [PROP_BIOCYC_ID, PROP_MODE]

    def __str__(self):
        return 'biocyc-regulation'
