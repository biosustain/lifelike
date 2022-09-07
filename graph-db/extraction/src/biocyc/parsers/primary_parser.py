import re

from biocyc.parsers.data_file_parser import DataFileParser, UNIQUE_ID
from biocyc.utils import get_attr_val_from_line, get_property_name_type
from common.graph_models import *

def reaction_layout(*args, **kwargs):
    print(args, kwargs)


ATTR_NAMES = {}
REL_NAMES = {
    'TYPES': RelationshipType(REL_TYPE, 'to', NODE_CLASS, PROP_BIOCYC_ID),
    'REACTION-LIST': RelationshipType(REL_IN_PATHWAY, 'from', NODE_PROTEIN, PROP_BIOCYC_ID),
    'IN-PATHWAY': RelationshipType(REL_IN_PATHWAY, 'to', NODE_PATHWAY, PROP_BIOCYC_ID)
}



class PrimaryParser(DataFileParser):
    def __init__(self, db_name, tarfile):
        DataFileParser.__init__(self, db_name, tarfile, 'pathways.dat', NODE_PRIMARY, ATTR_NAMES, REL_NAMES)
        self.attrs = [PROP_BIOCYC_ID, PROP_NAME, PROP_URL]

    LEFT_PRIMARIES = r'\(:LEFT-PRIMARIES ?(?P<LEFT_PRIMARIES>[^\)]*)\)'
    DIRECTION = r'\(:DIRECTION :(?P<DIRECTION>[^\)]*)\)'
    RIGHT_PRIMARIES = r'\(:RIGHT-PRIMARIES ?(?P<RIGHT_PRIMARIES>[^\)]*)\)'
    REACTION_LAYOUT = re.compile(
        f'\\((?P<REACTION>[^ ]*) {LEFT_PRIMARIES} {DIRECTION} {RIGHT_PRIMARIES}\\)'
    )

    def parse_reaction_layout(self, val):
        try:
            parsed = self.REACTION_LAYOUT.match(val).groupdict()
            parsed['LEFT_PRIMARIES'] = parsed['LEFT_PRIMARIES'].split(' ')
            parsed['RIGHT_PRIMARIES'] = parsed['RIGHT_PRIMARIES'].split(' ')
            return parsed
        except AttributeError as e:
            print(e)

    def parse_line(self, line, node, nodes):
        if not node:
            node = NodeData()
            nodes.append(node)
        try:
            attr, val = get_attr_val_from_line(line)
            if attr == 'REACTION-LAYOUT':
                layout = self.parse_reaction_layout(val)
                reaction_node = NodeData(NODE_REACTION, PROP_BIOCYC_ID)
                reaction_node.update_attribute(PROP_BIOCYC_ID, layout['REACTION'], 'str')
                for primary in layout['LEFT_PRIMARIES'] + layout['RIGHT_PRIMARIES']:
                    if primary:
                        compound_node = NodeData(NODE_REACTION, PROP_BIOCYC_ID)
                        compound_node.update_attribute(PROP_BIOCYC_ID, primary, 'str')
                        edge = EdgeData(reaction_node, compound_node, f'{REL_CONSUMED_BY}|{REL_PRODUCE}')
                        edge.add_attribute('PRIMARY', 'True', 'str')
                        node.edges.append(edge)

        except Exception as ex:
            self.logger.error('line:', line)
        return node



