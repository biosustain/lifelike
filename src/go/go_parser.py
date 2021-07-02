from common.graph_models import *
from common.constants import *
from common.obo_parser import OboParser
from common.base_parser import BaseParser
from common.database import *
from common.graph_models import NodeData
from common.query_builder import *
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s',
                    handlers=[logging.StreamHandler()])

attribute_map = {
            'id': (PROP_ID, 'str'),
            'name': (PROP_NAME, 'str'),
            'namespace': ('namespace', 'str'),
            'def': (PROP_DESCRIPTION, 'str'),
            'synonym': (PROP_SYNONYMS, 'str'),
            'is_obsolete': (PROP_OBSOLETE, 'str'),
            'alt_id': (PROP_ALT_ID, 'str'),
            # 'property_value': ()
        }

relationship_map = {
        # 'alt_id': RelationshipType(REL_ALT_ID, 'to', DB_GO, PROP_GO_ID, ),
        'is_a': RelationshipType(REL_IS_A, 'to', DB_GO, PROP_ID),
        'replaced_by': RelationshipType('replaced_by'.upper(), 'to', DB_GO, PROP_ID),
        'relationship': None
}

NODE_ATTRS = [PROP_ID, PROP_NAME, PROP_DESCRIPTION, PROP_ALT_ID, PROP_OBSOLETE]


class GoOboParser(OboParser, BaseParser):
    def __init__(self, basedir=None):
        BaseParser.__init__(self, 'go', basedir)
        OboParser.__init__(self, attribute_map, relationship_map, NODE_GO, PROP_ID)

    def create_indexes(self, database: Database):
        database.create_constraint(NODE_GO, PROP_ID, 'constraint_go_id')
        database.create_index(NODE_GO, PROP_NAME, 'index_go_name')
        database.create_constraint(NODE_SYNONYM, PROP_NAME, 'constraint_synonym_name')

    def parse_obo_file(self)->[NodeData]:
        logging.info('parsing go.obo')
        go_file = os.path.join(self.download_dir, 'go.obo')
        nodes = self.parse_file(go_file)
        logging.info(f'total go nodes: {len(nodes)}')
        return nodes

    def load_data_to_neo4j(self, database: Database, update=True):
        nodes = self.parse_obo_file()
        if not nodes:
            return
        logging.info('add nodes to ' + NODE_GO)
        # database.create_index(NODE_GO, PROP_ID)
        node_dict = dict()
        for node in nodes:
            node_label = node.get_attribute('namespace')
            if node_label not in node_dict:
                node_dict[node_label] = []
            node_dict[node_label].append(node.to_dict())
        for label in node_dict.keys():
            query = get_update_nodes_query(NODE_GO, PROP_ID, self.attributes_map.keys(), [label.title().replace('_', '')])
            database.load_data_from_rows(query, node_dict[label])

        self.load_synonyms(database, nodes, NODE_GO, PROP_ID)
        self.load_edges(database, nodes, NODE_GO, PROP_ID)


if __name__ == '__main__':
    parser = GoOboParser("/Users/rcai/data")
    # use the right database
    database = get_database(Neo4jInstance.LOCAL, '***ARANGO_DB_NAME***-qa')
    parser.load_data_to_neo4j(database)
    database.close()


