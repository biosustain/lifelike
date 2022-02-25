from biocyc.base_data_file_parser import BaseDataFileParser
from common.constants import *
from common.graph_models import RelationshipType


ATTR_NAMES = {
    'UNIQUE-ID': (PROP_BIOCYC_ID, 'str'),
    'COMMON-NAME': (PROP_NAME, 'str'),
    'SYNONYMS': (PROP_SYNONYMS, 'str')
}
REL_NAMES = {
    'ENZYME': RelationshipType(REL_CATALYZE, 'from', NODE_BIOCYC, PROP_BIOCYC_ID),
    'REACTION': RelationshipType(REL_CATALYZE, 'to', NODE_BIOCYC, PROP_BIOCYC_ID),
}


class EnzymeReactionParser(BaseDataFileParser):
    def __init__(self, prefix: str, db_name: str, tarfile: str, base_dir: str):
        super().__init__(prefix, base_dir, db_name, tarfile, 'enzrxns.dat', NODE_ENZ_REACTION,ATTR_NAMES, REL_NAMES)
        self.attrs = [PROP_BIOCYC_ID, PROP_NAME]

    def __str__(self):
        return 'biocyc-enzymereaction'

    def create_synonym_rels(self) -> bool:
        return True
