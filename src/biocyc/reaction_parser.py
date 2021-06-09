from biocyc.base_data_file_parser import *
from common.graph_models import *
import logging, tarfile, codecs

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s',
                    handlers=[logging.StreamHandler()])

ATTR_NAMES = {
    'UNIQUE-ID': (PROP_BIOCYC_ID, 'str'),
    'COMMON-NAME': (PROP_COMMON_NAME, 'str'),
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
    def __init__(self, db_name, tarfile, base_data_dir):
        BaseDataFileParser.__init__(self, base_data_dir,  db_name, tarfile, 'reactions.dat',
                                    NODE_REACTION,ATTR_NAMES, REL_NAMES, DB_LINK_SOURCES)
        self.attrs = [PROP_BIOCYC_ID, PROP_COMMON_NAME, PROP_EC_NUMBER, PROP_DIRECTION, PROP_LOCATION]

    def create_synonym_rels(self) -> bool:
        return True

    def parse_data_file(self):
        # logging.info('read ' + self.datafile + ' from ' + self.input_zip)
        with tarfile.open(self.input_zip, mode='r:gz') as tar:
            if not self.version:
                self.version = self.get_db_version(tar)
                print(self.version)
            for tarinfo in tar:
                if tarinfo.name.endswith('/'+ self.datafile) and self.version in tarinfo.name:
                    logging.info('parse ' + tarinfo.name)
                    utf8reader = codecs.getreader('ISO-8859-1')
                    f = utf8reader(tar.extractfile(tarinfo.name))
                    nodes = []
                    node = None
                    is_comment = False
                    for line in f:
                        try:
                            if line.startswith(UNIQUE_ID):
                                node = NodeData(self.node_labels.copy(), PROP_BIOCYC_ID)
                                nodes.append(node)
                            if node and PROP_COMMENT in self.attr_name_map and is_comment and line.startswith('/'):
                                line = line[1:].strip()
                                node.add_attribute(PROP_COMMENT, line, 'str')
                            elif node:
                                attr, val = biocyc_utils.get_attr_val_from_line(line)
                                if attr:
                                    if attr.lower() != PROP_COMMENT:
                                        # reset comment
                                        is_comment = False
                                    else:
                                        is_comment = True
                                    if attr in self.attr_name_map:
                                        prop_name, data_type = biocyc_utils.get_property_name_type(attr, self.attr_name_map)
                                        node.add_attribute(prop_name, val, data_type)
                                        if attr == UNIQUE_ID:
                                            node.add_attribute(PROP_ID, val, data_type)
                                    if attr in self.rel_name_map:
                                        # some rel could also be an attribute, e.g. types
                                        if attr == 'DBLINKS':
                                            tokens = val.split(' ')
                                            if len(tokens) > 1:
                                                db_name = tokens[0].lstrip('(')
                                                reference_id = tokens[1].strip(')').strip('"')
                                                add_prefix = tokens[1]
                                                self.add_dblink(node, db_name, reference_id, )
                                        else:
                                            rel_type = self.rel_name_map.get(attr)
                                            node.add_edge_type(rel_type, val)
                        except Exception as ex:
                            print('line:', line)
                    return nodes

    def parse_data_file(self):



        nodes = BaseDataFileParser.parse_data_file(self)
        for node in nodes:
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
        return nodes



