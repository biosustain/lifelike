from common.graph_models import *
from common.constants import *
from common.obo_parser import OboParser
from common.base_parser import BaseParser
from common.database import *
from common.graph_models import NodeData
from common.query_builder import *

import csv
import logging
import pandas as pd

from create_data_file import azure_upload

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
        'is_a': RelationshipType(REL_IS_A, 'to', NODE_GO, PROP_ID),
        'replaced_by': RelationshipType('replaced_by'.upper(), 'to', NODE_GO, PROP_ID),
        'relationship': None
}

NODE_ATTRS = [PROP_ID, PROP_NAME, PROP_DESCRIPTION, PROP_ALT_ID, PROP_OBSOLETE, PROP_DATA_SOURCE]


class GoOboParser(OboParser, BaseParser):
    def __init__(self, basedir=None):
        BaseParser.__init__(self, 'go', basedir)
        OboParser.__init__(self, attribute_map, relationship_map, NODE_GO, PROP_ID)
        self.id_prefix = 'GO:'
        self.logger = logging.getLogger(__name__)

    def create_indexes(self, database: Database):
        database.create_constraint(NODE_GO, PROP_ID, 'constraint_go_id')
        database.create_index(NODE_GO, PROP_NAME, 'index_go_name')
        database.create_constraint(NODE_SYNONYM, PROP_NAME, 'constraint_synonym_name')

    def parse_obo_file(self):
        self.logger.info("Parsing go.obo")
        go_file = os.path.join(self.download_dir, 'go.obo')
        nodes = self.parse_file(go_file)
        # need to remove prefix 'GO:' from id
        for node in nodes:
            node.update_attribute(PROP_ID, node.get_attribute(PROP_ID).replace(self.id_prefix, ''))
            node.update_attribute(PROP_DATA_SOURCE, DB_GO)
        self.logger.info(f"Total go nodes: {len(nodes)}")

        filename = 'jira-LL-3213-go-data.tsv'
        filepath = os.path.join(self.output_dir, filename)
        zip_filename = 'jira-LL-3213-go-data.zip'
        zip_filepath = os.path.join(self.output_dir, zip_filename)

        df = pd.DataFrame([node.to_dict() for node in nodes])
        df.fillna('', inplace=True)
        with open(filepath, 'w', newline='\n') as tsvfile:
            writer = csv.writer(tsvfile, delimiter='\t', quotechar='"')
            writer.writerow(list(df.columns.values))

        df.to_csv(filepath, sep='\t', index=False)
        azure_upload(filepath, filename, zip_filename, zip_filepath)

        filename = 'jira-LL-3213-go-relationship-data.tsv'
        filepath = os.path.join(self.output_dir, filename)
        zip_filename = 'jira-LL-3213-go-relationship-data.zip'
        zip_filepath = os.path.join(self.output_dir, zip_filename)

        df = pd.DataFrame([{
            'relationship': edge.label,
            'from_id': edge.source.attributes['eid'],
            'to_id': edge.dest.attributes['eid']} for node in nodes for edge in node.edges])
        df.fillna('', inplace=True)

        with open(filepath, 'w', newline='\n') as tsvfile:
            writer = csv.writer(tsvfile, delimiter='\t', quotechar='"')
            writer.writerow(list(df.columns.values))

        df.to_csv(filepath, sep='\t', index=False)
        azure_upload(filepath, filename, zip_filename, zip_filepath)
        return nodes

    def load_data_to_neo4j(self, database: Database):
        nodes = self.parse_obo_file()
        if not nodes:
            return
        
        # self.create_indexes(database)

        # self.logger.info("Add nodes to " + NODE_GO)
        # node_dict = dict()
        # for node in nodes:
        #     node_label = node.get_attribute('namespace')
        #     if node_label not in node_dict:
        #         node_dict[node_label] = []
        #     node_dict[node_label].append(node.to_dict())
        # for label in node_dict.keys():
        #     query = get_update_nodes_query(NODE_GO, PROP_ID, NODE_ATTRS, [label.title().replace('_', '')])
        #     database.load_data_from_rows(query, node_dict[label])

        # self.load_synonyms(database, nodes, NODE_GO, PROP_ID)
        # self.load_edges(database, nodes, NODE_GO, PROP_ID)


def main():
    parser = GoOboParser()
    database = get_database()
    parser.load_data_to_neo4j(database)
    database.close()


if __name__ == "__main__":
    main()


