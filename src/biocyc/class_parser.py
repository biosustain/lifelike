from biocyc.base_data_file_parser import BaseDataFileParser
from common.graph_models import *
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s',
                    handlers=[logging.StreamHandler()])

ATTR_NAMES = {
    'UNIQUE-ID': (PROP_BIOCYC_ID, 'str'),
    'COMMON-NAME': (PROP_COMMON_NAME, 'str'),
    'SYNONYMS': (PROP_SYNONYMS, 'str'),
}
REL_NAMES = {
    'TYPES': RelationshipType(REL_TYPE, 'to', NODE_CLASS, PROP_BIOCYC_ID),
}

FRAMES = 'FRAMES'

class ClassParser(BaseDataFileParser):
    def __init__(self, db_name, tarfile, base_data_dir):
        BaseDataFileParser.__init__(self, base_data_dir, db_name, tarfile, 'classes.dat', NODE_CLASS, ATTR_NAMES, REL_NAMES)
        self.attrs = [PROP_BIOCYC_ID, PROP_COMMON_NAME, PROP_SYNONYMS]

    def create_synonym_rels(self) -> bool:
        return False

    def parse_data_file(self):
        nodes = BaseDataFileParser.parse_data_file(self)
        mynodes = []
        for node in nodes:
            if node.get_attribute(PROP_BIOCYC_ID).startswith('GO:') or \
                    node.get_attribute(PROP_BIOCYC_ID).startswith('TAX-') or \
                    node.get_attribute(PROP_BIOCYC_ID).startswith('ORG-'):
                continue
            mynodes.append(node)
            ## remove general protein type from type_of relationship
            edges = set(node.edges)
            for edge in edges:
                if edge.label == REL_TYPE:
                    if edge.dest.get_attribute(PROP_BIOCYC_ID) == FRAMES or edge.source.get_attribute(PROP_BIOCYC_ID)==FRAMES:
                        node.edges.remove(edge)
        return mynodes


