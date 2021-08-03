from common.constants import *
from common.database import *
from common.base_parser import BaseParser
from mesh.mesh_annotations import add_annotation_entity_labels
from mesh.mesh_LMDB_annotation import write_mesh_annotation_files
import pandas as pd
import os


class MeshParser(BaseParser):
    def __init__(self, base_data_dir):
        BaseParser.__init__(self, 'mesh', base_data_dir)
        self.logger = logging.getLogger(__name__)
        self.datafile = os.path.join(self.download_dir, 'mesh.nt')

    def import_mesh_rdf(self, meshdatabase:Database):
        '''
        Load mesh rdf file to Neo4j database using neosemantics
        :param meshdatabase: neo4j database for mesh terms (not lifelike)
        :param url: mesh.nt location
        :return:
        '''
        # clean the database before loading meshs
        query = """
        match(n) detach delete n
        """
        meshdatabase.run_query(query)

        meshdatabase.create_constraint('Resource', 'uri', 'uri_constraint')
        # import mesh terms into graphdb
        query = 'CALL n10s.graphconfig.init()'
        meshdatabase.run_query(query)
        query = """
        CALL n10s.graphconfig.set({
            handleVocabUris: "IGNORE",
            handleMultival: 'ARRAY',
            multivalPropList : ['http://id.nlm.nih.gov/mesh/vocab#altLabel']
        });
        """
        meshdatabase.run_query(query)
        query = f"CALL n10s.rdf.import.fetch('file:///{self.datafile}', 'N-Triples')"
        meshdatabase.run_query(query)

    def create_indexes(self, database: Database):
        database.create_constraint(NODE_MESH, PROP_ID, 'constraint_mesh_id')
        database.create_index(NODE_MESH, PROP_NAME, 'index_mesh_name')
        database.create_constraint(NODE_SYNONYM, PROP_NAME, 'index_synonym_name')

    def load_data_to_neo4j(self, from_database: Database, to_database:Database):
        """
        Mesh data was loaded into mesh_database. Need to query the data, and load into lifelike database
        :param to_database: the lifelike database
        :param from_database: database with mesh data from RDF file
        :return:
        """
        self._load_treenumber(from_database, to_database)
        self._load_topical_descriptor(from_database, to_database)
        self._load_chemical(from_database, to_database)
        self._load_disease(from_database, to_database)
        self._load_synonym(from_database, to_database)

    def _load_treenumber(self, from_database, to_database):
        self.logger.info("Load treenumber nodes")
        query = "match(t:TreeNumber) return t.label as id"
        df = from_database.get_data(query)
        df[PROP_OBSOLETE] = df[PROP_ID].str.startswith('[OBSOLETE]').astype(int)
        df[PROP_ID] = df[PROP_ID].str.replace('[OBSOLETE]', '', regex=False).str.strip()
        self.logger.info(f"{len(df)}")
        load_query = get_update_nodes_query(NODE_MESH, PROP_ID, [PROP_OBSOLETE], [NODE_TREENUMBER])
        to_database.load_data_from_dataframe(df, load_query)

        self.logger.info("node treenumber has_parent relationship")
        query = "match(t:TreeNumber)-[:parentTreeNumber]->(p:TreeNumber) return t.label as id, p.label as parent_id"
        df = from_database.get_data(query)
        self.logger.info(f"{len(df)}")
        df[PROP_ID] = df[PROP_ID].str.replace('[OBSOLETE]', '', regex=False).str.strip()
        df[PROP_PARENT_ID] = df[PROP_PARENT_ID].str.replace('[OBSOLETE]', '', regex=False).str.strip()
        load_query = get_create_relationships_query(NODE_MESH, PROP_ID, PROP_ID, NODE_MESH, PROP_ID, PROP_PARENT_ID, REL_PARENT)
        to_database.load_data_from_dataframe(df, load_query)

    def _load_topical_descriptor(self, from_database, to_database):
        self.logger.info("load topicaldescriptor nodes")
        query = "match (d:TopicalDescriptor) return 'MESH:' + d.identifier as id, d.label as name"
        df = from_database.get_data(query)
        self.logger.info(f"{len(df)}")
        df[PROP_OBSOLETE] = df['name'].str.startswith('[OBSOLETE]').astype(int)
        df[PROP_NAME] = df['name'].str.replace('[OBSOLETE]', '', regex=False).str.strip()

        query = get_update_nodes_query(NODE_MESH, PROP_ID, [PROP_NAME, PROP_OBSOLETE], [NODE_TOPICALDESC])
        to_database.load_data_from_dataframe(df, query)

        self.logger.info("map mesh to tree-number")
        query = "match(t:TreeNumber)-[]-(d:TopicalDescriptor) return 'MESH:' + d.identifier as id, t.label as treenumber"
        df = from_database.get_data(query)
        self.logger.info(f"{len(df)}")
        df['treenumber'] = df['treenumber'].str.replace('[OBSOLETE]', '', regex=False).str.strip()
        query = get_create_relationships_query(NODE_MESH, PROP_ID, PROP_ID, NODE_MESH, PROP_ID, 'treenumber',
                                               REL_TREENUMBER)
        to_database.load_data_from_dataframe(df, query)

    def _load_chemical(self, from_database, to_database):
        self.logger.info("node mesh chemical nodes")
        query = "match (n:SCR_Chemical) return 'MESH:' + n.identifier as id, n.label as name"
        df = from_database.get_data(query)
        self.logger.info(f"{len(df)}")
        df[PROP_OBSOLETE] = df[PROP_NAME].str.startswith('[OBSOLETE]').astype(int)
        df[PROP_NAME] = df[PROP_NAME].str.replace('[OBSOLETE]', '', regex=False).str.strip()

        query = get_update_nodes_query(NODE_MESH, PROP_ID, [PROP_NAME, PROP_OBSOLETE], [NODE_CHEMICAL])
        to_database.load_data_from_dataframe(df, query)

        self.logger.info("map chemical to topical descriptor")
        query = """
            match(n:SCR_Chemical)-[r:preferredMappedTo|mappedTo]->(d:TopicalDescriptor)
            with n, d, r match(d)-[:treeNumber]-(t:TreeNumber) where substring(t.label, 0, 1) = 'D'
            return distinct 'MESH:' + n.identifier as id, 'MESH:' + d.identifier as descriptor_id, type(r) as type 
            """
        df = from_database.get_data(query)
        self.logger.info(f"{len(df)}")
        query = get_create_relationships_query(NODE_MESH, PROP_ID, PROP_ID, NODE_MESH, PROP_ID,
                                               'descriptor_id', REL_MAPPED_TO_DESCRIPTOR, [PROP_TYPE])
        to_database.load_data_from_dataframe(df, query)

    def _load_disease(self, from_database, to_database):
        self.logger.info("load mesh disease ndoes")
        query = "match (n:SCR_Disease) return 'MESH:' + n.identifier as id, n.label as name"
        df = from_database.get_data(query)
        df[PROP_OBSOLETE] = df[PROP_NAME].str.startswith('[OBSOLETE]').astype(int)
        df[PROP_NAME] = df[PROP_NAME].str.replace('[OBSOLETE]', '', regex=False).str.strip()
        self.logger.info(f"{len(df)}")
        query = get_update_nodes_query(NODE_MESH, PROP_ID, [PROP_NAME, PROP_OBSOLETE], [NODE_DISEASE])
        to_database.load_data_from_dataframe(df, query)

        self.logger.info("map disease to topical descriptor")
        query = """
            match(n:SCR_Disease)-[r:preferredMappedTo|mappedTo]->(d:TopicalDescriptor)
            with n, d, r match(d)-[:treeNumber]-(t:TreeNumber) where substring(t.label, 0, 1) = 'C'
            return distinct 'MESH:' + n.identifier as id, 'MESH:' + d.identifier as descriptor_id, type(r) as type
            """
        df = from_database.get_data(query)
        self.logger.info(f"{len(df)}")
        query = get_create_relationships_query(NODE_MESH, PROP_ID, PROP_ID, NODE_MESH, PROP_ID, 'descriptor_id', REL_MAPPED_TO_DESCRIPTOR, [PROP_TYPE])
        to_database.load_data_from_dataframe(df, query)

    def _load_synonym(self, from_database, to_database):
        query = """
            match (n:TopicalDescriptor)-[]-(:Concept) -[]-(t:Term)
            with n, [t.prefLabel]+coalesce(t.altLabel, []) as terms
            unwind terms as synonym
            return 'MESH:' + n.identifier as id, synonym
            UNION
            match (n:SCR_Chemical)-[]-(:Concept)-[]-(t:Term)
            with n, [t.prefLabel]+coalesce(t.altLabel, []) as terms
            unwind terms as synonym
            return 'MESH:'+n.identifier as id, synonym
            UNION
            match (n:SCR_Disease)-[]-(:Concept)-[]-(t:Term)
            with n, [t.prefLabel]+coalesce(t.altLabel, []) as terms
            unwind terms as synonym
            return 'MESH:'+n.identifier as id, synonym
        """
        df = from_database.get_data(query)
        self.logger.info(f"{len(df)}")
        query = get_create_synonym_relationships_query(NODE_MESH, PROP_ID, PROP_ID, 'synonym')
        to_database.load_data_from_dataframe(df, query)

    def remove_synonyms_with_comma(self, database):
        query = """
        match(n:TopicalDescriptor)-[:HAS_TREENUMBER]-(t) where left(t.id, 1) in ['A', 'C', 'F', 'G'] 
        with distinct n match (n)-[r:HAS_SYNONYM]-(s) where s.name contains ',' 
        delete r
        """
        database.run_query(query)

        query = "match (n:Disease)-[r:HAS_SYNONYM]-(s) where s.name contains ',' delete r"
        database.run_query(query)

        # delete orphan nodes
        query = "match(n:Synonym) where not (n)-[]-() delete n"
        database.run_query(query)

    def set_data_source(self, database):
        query = """
                match(n:db_MESH) set n.data_source='MeSH'
                """
        database.run_query(query)


def main():
    lifelike_db = get_database()
    parser = MeshParser()
    # create a database 'meshdb' in neo4j for mesh rdf data
    meshdb = 'meshdb'
    query = f"CREATE OR REPLACE DATABASE {meshdb}"
    lifelike_db.run_query(query)

    mesh_db = get_database()
    mesh_db.dbname = meshdb
    parser.import_mesh_rdf(mesh_db)

    parser.load_data_to_neo4j(mesh_db, lifelike_db)
    parser.remove_synonyms_with_comma(lifelike_db)
    parser.set_data_source(lifelike_db)
    add_annotation_entity_labels(lifelike_db)
    mesh_db.close()
    # can drop meshdb now
    write_mesh_annotation_files(lifelike_db, parser.output_dir)
    lifelike_db.close()


if __name__ == "__main__":
    main()


