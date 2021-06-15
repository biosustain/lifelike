from common.graph_models import *
from common.constants import *
from common.database import Database
from common.query_builder import *
from common.base_parser import BaseParser
import logging
import gzip
import re

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s',
                    handlers=[logging.StreamHandler()])

class OboParser(object):
    """
    Base parser to parse obo format files.
    """
    def __init__(self, attributes_map: dict, relationships_map: dict, node_labels, node_id_attr_name: str):
        self.attributes_map = attributes_map
        self.relationships_map = relationships_map
        self.node_labels = node_labels
        self.node_id_name = node_id_attr_name
        self.rel_names = set()

    def parse_file(self, file_path)->[NodeData]:
        with open(file_path, 'r', encoding="ISO-8859-1") as file_data:
            return self._map_nodes(file_data)

    def parse_zip_file(self, zip_file_path)->[NodeData]:
        with gzip.open(zip_file_path, 'rt') as file_data:
            return self._map_nodes(file_data)

    def _map_nodes(self, file_data)->[NodeData]:
        nodes = list()
        for line in file_data:
            if line.strip().startswith('[Term]'):
                node = NodeData(self.node_labels, self.node_id_name)
                for line in file_data:
                    # End processing of a single record
                    if line == '\n':
                        nodes.append(node)
                        break
                    # Processing single records
                    else:
                        attr_name, attr_val = line.split(': ', 1)
                        self._process_property(node, attr_name, attr_val)
        print('total nodes', len(nodes))
        print('relationships:', self.rel_names)
        return nodes

    def _process_property(self, node: NodeData, attr_name: str, attr_val: str):
        if not attr_name in self.attributes_map and not attr_name in self.relationships_map:
            return
        if attr_name == 'property_value':
            prop_identifier, value, _ = attr_val.split(' ')
            name_tokens = prop_identifier.rsplit('/', 1)
            name = name_tokens[1]
            value = value.replace('"', '')
            if name in self.attributes_map:
                attr_type = self.attributes_map[name]
                node.add_attribute(attr_type[0], value.strip(), attr_type[1])
        elif attr_name == 'synonym':
            match = re.search(r'".+"', attr_val)
            if match:
                value = match.group(0).replace('"', '').strip()
                if value != node.get_attribute(PROP_NAME):
                    node.add_attribute(PROP_SYNONYMS, value, 'str')
        elif attr_name in self.attributes_map:
            attr_type = self.attributes_map[attr_name]
            if '"' in attr_val:
                match = re.search(r'".+"', attr_val)
                if match:
                    attr_val = match.group(0).replace('"', '')
            node.add_attribute(attr_type[0], attr_val.strip(), attr_type[1])
        elif attr_name == 'relationship':
            vals = attr_val.split(' ')
            rel_name = vals[0].upper()
            rel_val = vals[1]
            rel_node = NodeData(self.node_labels, self.node_id_name)
            rel_node.update_attribute(self.node_id_name, rel_val.strip())
            node.add_edge(node, rel_node, rel_name)
            self.rel_names.add(rel_name)
        elif attr_name in self.relationships_map:
            vals = attr_val.split(' ')
            rel_val = vals[0]
            node.add_edge_type(self.relationships_map[attr_name], rel_val.strip())

    @classmethod
    def load_nodes(cls, database: Database, nodes:[], db_node_label, entity_node_label, id_name, node_attributes:[]):
        if not nodes:
            return
        node_rows = [node.to_dict() for node in nodes]
        query = get_create_nodes_query(db_node_label, id_name, node_attributes, [entity_node_label])
        database.load_data_from_rows(query, node_rows)

    @classmethod
    def update_nodes(cls, database: Database, nodes:[], node_label, id_name, node_attributes: []):
        if not nodes:
            return
        node_rows = [node.to_dict() for node in nodes]
        query = get_update_nodes_query(node_label, id_name, node_attributes)
        database.load_data_from_rows(query, node_rows)

    @classmethod
    def load_synonyms(cls, database: Database, nodes: [], node_label, node_id_name):
        entity2synonym_list = []
        for node in nodes:
            synonyms = node.get_synonym_set()
            id = node.get_attribute(node_id_name)
            for syn in synonyms:
                entity2synonym_list.append({node_id_name: id, PROP_NAME: syn})
        if not entity2synonym_list:
            return
        logging.info(f'add {node_label} synonyms')
        query = get_create_nodes_relationships_query(NODE_SYNONYM, PROP_NAME, PROP_NAME, node_label,
                                                                node_id_name, node_id_name, REL_SYNONYM, False)
        database.load_data_from_rows(query, entity2synonym_list)

    @classmethod
    def load_edges(cls, database: Database, nodes:[], node_label, node_id_name):
        entity2entity_dict = dict()
        for node in nodes:
            for edge in node.edges:
                from_id = edge.source.get_attribute(edge.source.id_attr)
                to_id = edge.dest.get_attribute(edge.dest.id_attr)
                rel = edge.label
                if rel not in entity2entity_dict:
                    entity2entity_dict[rel] = []
                entity2entity_dict[rel].append({'from_id': from_id, 'to_id': to_id})
        if not entity2entity_dict:
            return
        for rel in entity2entity_dict.keys():
            logging.info("relationship: " + rel)
            query = get_create_relationships_query(node_label, node_id_name, 'from_id', node_label, node_id_name, 'to_id', rel)
            database.load_data_from_rows(query, entity2entity_dict[rel])