from common.graph_models import *
from common.constants import *
from common.obo_parser import OboParser
from common.base_parser import BaseParser
from common.database import *
from common.graph_models import NodeData
from common.query_builder import *
import logging


attribute_map = {
            'id': (PROP_ID, 'str'),
            'name': (PROP_NAME, 'str'),
            'def': (PROP_DEF, 'str'),
            'formula': ('formula', 'str'),
            'charge': ('charge', 'str'),
            'inchi': (PROP_INCHI, 'str'),
            'inchikey': (PROP_INCHI_KEY, 'str'),
            'smiles': (PROP_SMILES, 'str'),
            'mass': ('mass', 'str'),
            'synonym': (PROP_SYNONYMS, 'str'),
            'alt_id': (PROP_ALT_ID, 'str'),
            'property_value': ()
        }

relationship_map = {
        # 'alt_id': RelationshipType(REL_ALT_ID, 'to', DB_CHEBI, PROP_CHEBI_ID),
        'is_a': RelationshipType(REL_IS_A, 'to', DB_CHEBI, PROP_ID),
        'relationship': RelationshipType(None, 'to', DB_CHEBI, PROP_ID)
}

NODE_ATTRS = [PROP_ID, PROP_NAME, PROP_DEF, PROP_INCHI, PROP_INCHI_KEY, PROP_SMILES, PROP_ALT_ID]


class ChebiOboParser(OboParser, BaseParser):
    def __init__(self, basedir=None):
        BaseParser.__init__(self, 'chebi', basedir)
        OboParser.__init__(self, attribute_map, relationship_map, NODE_CHEBI, PROP_ID)
        self.logger = logging.getLogger(__name__)

    def create_indexes(self, database: Database):
        """
        Create indices and constraint if thet don't already exist
        """
        database.create_constraint(NODE_CHEBI, PROP_ID, "constraint_chebi_id")
        database.create_index(NODE_CHEBI, PROP_NAME, "index_chebi_name")
        database.create_constraint(NODE_SYNONYM, PROP_NAME, "constraint_synonym_name")

    def parse_obo_file(self)->[NodeData]:
        self.logger.info("Parsing chebi.obo")
        file = os.path.join(self.download_dir, 'chebi.obo')
        nodes = self.parse_file(file)
        self.logger.info(f"Number of chebi nodes parsed from chebi.obo: {len(nodes)}")
        return nodes

    def load_data_to_neo4j(self, database: Database):
        nodes = self.parse_obo_file()
        if not nodes:
            return

        self.create_indexes(database)

        self.logger.info("Add nodes to " + NODE_CHEBI)
        self.load_nodes(database, nodes, NODE_CHEBI, NODE_CHEMICAL, PROP_ID, NODE_ATTRS)
        self.logger.info("Add synonyms to " + NODE_CHEBI)
        self.load_synonyms(database, nodes, NODE_CHEBI, PROP_ID)
        self.logger.info("Add edges to " + NODE_CHEBI)
        self.load_edges(database, nodes, NODE_CHEBI, PROP_ID)


def main():
    parser = ChebiOboParser()
    database = get_database()
    parser.load_data_to_neo4j(database)
    database.close()


if __name__ == "__main__":
    main()
