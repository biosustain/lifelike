from biocyc.base_data_file_parser import BaseDataFileParser
from common.constants import *
from common.graph_models import RelationshipType

ATTR_NAMES = {
    'UNIQUE-ID': (PROP_BIOCYC_ID, 'str'),
    'COMMON-NAME': (PROP_NAME, 'str'),
    'SYNONYMS': (PROP_SYNONYMS, 'str'),
}
REL_NAMES = {
    'TYPES': RelationshipType(REL_TYPE, 'to', NODE_CLASS, PROP_BIOCYC_ID),
}

FRAMES = 'FRAMES'

class ClassParser(BaseDataFileParser):
    """
    The classes.dat file contains list of terms for biocyc classification, including some go terms and taxonomy.
    """
    def __init__(self, prefix: str, db_name: str, tarfile: str, base_dir: str):
        super().__init__(prefix, base_dir, db_name, tarfile, 'classes.dat', NODE_CLASS, ATTR_NAMES, REL_NAMES)
        self.attrs = [PROP_BIOCYC_ID, PROP_NAME, PROP_SYNONYMS]

    def __str__(self):
        return 'biocyc-class'

    def create_synonym_rels(self) -> bool:
        return False

    def parse_and_write_data_files(self, *args):
        """Parse source data file."""
        nodes = super().parse_data_file()
        mynodes = [n for n in nodes if not n.get_attribute(PROP_BIOCYC_ID).startswith(('GO:', 'TAX-', 'ORG-'))]
        for node in mynodes:
            edges_with_type_of = set([e for e in node.edges if e.label == REL_TYPE])
            # Skip relationships of type FRAMES, since there is no biocyc id 'FRAMES'
            node.edges = [edge for edge in edges_with_type_of if edge.dest.get_attribute(PROP_BIOCYC_ID) != FRAMES and edge.source.get_attribute(PROP_BIOCYC_ID) != FRAMES]
        super().parse_and_write_data_files(nodes)
