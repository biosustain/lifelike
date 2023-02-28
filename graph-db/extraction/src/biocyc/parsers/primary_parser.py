import re
from itertools import chain, repeat

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
    DIRECTION = r'\(:DIRECTION :?(?P<DIRECTION>[^\)]*)\)'
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

    def assign_edge_label(self, layout):
        """
        returns - labeled primaries
        """
        # This one is fixed later on when reaction is getting reversed
        # left_edge_label, right_edge_label = \
        #     (REL_CONSUMED_BY, REL_PRODUCE) if layout['DIRECTION'] == 'L2R' \
        #         else (REL_PRODUCE, REL_CONSUMED_BY)
        left_edge_label, right_edge_label = (REL_CONSUMED_BY, REL_PRODUCE)
        return chain(
            zip(layout['LEFT_PRIMARIES'], repeat(left_edge_label)),
            zip(layout['RIGHT_PRIMARIES'], repeat(right_edge_label))
        )

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
                for (primary, edge_label) in self.assign_edge_label(layout):
                    if primary:
                        compound_node = NodeData(NODE_REACTION, PROP_BIOCYC_ID)
                        compound_node.update_attribute(PROP_BIOCYC_ID, primary, 'str')
                        # add property on edge
                        if edge_label == REL_PRODUCE:
                            edge = EdgeData(reaction_node, compound_node, edge_label)
                        else:
                            edge = EdgeData(compound_node, reaction_node, edge_label)
                        edge.add_attribute('PRIMARY', 'True', 'str')
                        node.edges.append(edge)
        except Exception as ex:
            self.logger.error('line:', line, 'error:', ex)
        return node



