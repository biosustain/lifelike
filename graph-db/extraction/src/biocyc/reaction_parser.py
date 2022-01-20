from biocyc.base_data_file_parser import BaseDataFileParser
from common.constants import *
from common.graph_models import RelationshipType


ATTR_NAMES = {
    'UNIQUE-ID': (PROP_BIOCYC_ID, 'str'),
    'COMMON-NAME': (PROP_NAME, 'str'),
    'EC-NUMBER': (PROP_EC_NUMBER, 'str'),
    'SYSTEMATIC-NAME': (PROP_OTHER_NAME, 'str'),
    'REACTION-DIRECTION': (PROP_DIRECTION, 'str'),
    'RXN-LOCATIONS': (PROP_LOCATION, 'str'),
    'SYNONYMS': (PROP_SYNONYMS, 'str'),
    'RXN-LOCATIONS': (PROP_LOCATION, 'str')
}
REL_NAMES = {
    'TYPES': RelationshipType(REL_TYPE, 'to', NODE_CLASS, PROP_BIOCYC_ID),
    'LEFT': RelationshipType(REL_CONSUMED_BY, 'from', NODE_COMPOUND, PROP_BIOCYC_ID),
    'RIGHT': RelationshipType(REL_PRODUCE, 'to', NODE_COMPOUND, PROP_BIOCYC_ID),
}

REL_ATTRS = {
    'LEFT': {'^COMPARTMENT': PROP_COMPARTMENT},
    'RIGHT': {'^COMPARTMENT': PROP_COMPARTMENT}
}

# False means not adding prefix 'Enzyme' to reference id
DB_LINK_SOURCES = {DB_ENZYME: False}

CHEM_REACTIONS = 'Chemical-Reactions'
SMALL_MOL_REACTIONS = 'Small-Molecule-Reactions'


class ReactionParser(BaseDataFileParser):
    def __init__(self, prefix: str, db_name: str, tarfile: str, base_dir: str):
        super().__init__(prefix, base_dir, db_name, tarfile, 'reactions.dat', NODE_REACTION,ATTR_NAMES, REL_NAMES, DB_LINK_SOURCES)
        self.attrs = [PROP_BIOCYC_ID, PROP_NAME, PROP_EC_NUMBER]

    def __str__(self):
        return 'biocyc-reaction'

    def create_synonym_rels(self) -> bool:
        return True

    def parse_and_write_data_files(self):
        """
        After parsing the file, remove the 'TYPE_OF' relationships for the general reaction type (chemical reaction, small molecule reaction)
        because we don't need those information, and the additional relationshps made the node expanding more complicated.
        Reation property EC_number need to be treated as relationships to Enzyme nodes.
        """
        for node in self.nodes:
            edges = set(node.edges)
            for edge in edges:
                if edge.label == REL_TYPE:
                    if edge.dest.get_attribute(PROP_BIOCYC_ID) in [CHEM_REACTIONS, SMALL_MOL_REACTIONS]:
                        node.edges.remove(edge)
            ec_number_str = node.get_attribute(PROP_EC_NUMBER)
            if ec_number_str:
                ec_numbers = ec_number_str.split('|')
                for ec in ec_numbers:
                    self.add_dblink(node, DB_ENZYME, ec)
        super().parse_and_write_data_files()
