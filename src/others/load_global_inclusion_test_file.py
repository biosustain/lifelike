from neo4j import GraphDatabase
from common.database import *
from common.constants import *
from common import utils
import pandas as pd
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s',
                    handlers=[logging.StreamHandler()])

KG_DOMAINS = [DB_NCBI, DB_MESH, DB_UNIPROT]


class GlobalInclusionFileLoad(object):
    def __init__(self, file:str, database:Database):
        self.file = file
        self.database = database

    def parse_file(self):
        columns = ['domain', 'data_source', 'external_id', 'name', 'type', 'hyperlink', 'inclusion_date', 'user']
        df = pd.read_excel(self.file, names=columns)
        df = df.astype('str')
        df = df.replace('nan', '')
        return df

    def load_mesh_terms(self, df:pd.DataFrame):
        query = """
        with $dict.rows as rows unwind rows as row
        match (n:db_MESH) where n.id = 'MESH:' + row.external_id
        set n.entity_type = row.type, n.inclusion_date = apoc.date.parseAsZonedDateTime(row.inclusion_date), n.user = row.user 
        merge (s:Synonym {name:row.name}) 
        merge (n)-[r:HAS_SYNONYM]->(s) set r.inclusion_date = n.inclusion_date, r.user = n.user
        """
        self.database.load_data_from_dataframe(df, query)

    def load_ncbigene_terms(self, df: pd.DataFrame):
        query = """
        with $dict.rows as rows unwind rows as row
        match (n:Gene) where n.id = row.external_id
        set n.inclusion_date = apoc.date.parseAsZonedDateTime(row.inclusion_date), n.user = row.user 
        merge (s:Synonym {name:row.name}) 
        merge (n)-[r:HAS_SYNONYM]->(s) set r.inclusion_date = n.inclusion_date, r.user = n.user
        """
        self.database.load_data_from_dataframe(df, query)

    def load_taxonomy_terms(self, df: pd.DataFrame):
        query = """
        with $dict.rows as rows unwind rows as row
        match (n:Taxonomy) where n.id = trim(row.external_id)
        set n.entity_type = row.type, n.inclusion_date = apoc.date.parseAsZonedDateTime(row.inclusion_date), n.user = row.user 
        merge (s:Synonym {name:row.name}) 
        merge (n)-[r:HAS_SYNONYM]->(s) set r.inclusion_date = n.inclusion_date, r.user = n.user
        """
        self.database.load_data_from_dataframe(df, query)

    def load_uniprot_terms(self, df: pd.DataFrame):
        query = """
        with $dict.rows as rows unwind rows as row
        match (n:db_UniProt) where n.id = row.external_id
        set n.inclusion_date = apoc.date.parseAsZonedDateTime(row.inclusion_date), n.user = row.user 
        merge (s:Synonym {name:row.name}) 
        merge (n)-[r:HAS_SYNONYM]->(s) set r.inclusion_date = n.inclusion_date, r.user = n.user
        """
        self.database.load_data_from_dataframe(df, query)

    def load_lifelike_terms_with_datasource(self, df: pd.DataFrame):
        query = """
        with $dict.rows as rows unwind rows as row
        merge (n:db_Lifelike {id:row.data_source + ':' + row.external_id}) 
        set n.data_source = row.data_source, n.external_id = row.external_id, n.name = row.name, n.entity_type = row.type, 
        n.hyperlink = row.hyperlink, n.inclusion_date = apoc.date.parseAsZonedDateTime(row.inclusion_date), n.user = row.user
        merge (s:Synonym {name:row.name}) 
        merge (n)-[r:HAS_SYNONYM]->(s) set r.inclusion_date = n.inclusion_date, r.user = n.user 
        """
        self.database.load_data_from_dataframe(df, query)

    def load_lifelike_terms_without_datasource(self, df: pd.DataFrame):
        query = """
        with $dict.rows as rows unwind rows as row
        merge (n:db_Lifelike {id:'Lifelike:' + row.name}) 
        set n.name = row.name, n.entity_type = row.type, 
        n.inclusion_date = apoc.date.parseAsZonedDateTime(row.inclusion_date), n.user = row.user
        merge (s:Synonym {name:row.name}) 
        merge (n)-[r:HAS_SYNONYM]->(s) set r.inclusion_date = n.inclusion_date, r.user = n.user 
        """
        self.database.load_data_from_dataframe(df, query)

    def create_indexes(self):
        self.database.create_index(NODE_GENE, 'inclusion_date', 'index_gene_inclusiondate')
        self.database.create_index(NODE_TAXONOMY, 'inclusion_date', 'index_taxonomy_inclusiondate')


def add_global_inclusion_test_file(file, database):
    """
    LL-3096
    Load the file to neo4j-staging only (for test).
    """
    filepath = os.path.join(utils.get_data_dir(), file)
    loader = GlobalInclusionFileLoad(filepath, database)
    df = loader.parse_file()
    logging.info('add mesh terms')
    df_mesh = df[df['domain']=='MESH']
    loader.load_mesh_terms(df_mesh)
    logging.info('add ncbi genes')
    df_gene = df[df['data_source'] == 'NCBI Gene']
    loader.load_ncbigene_terms(df_gene)
    logging.info('add taxonomy')
    df_tax = df[df['data_source'] == 'NCBI Taxonomy']
    loader.load_taxonomy_terms(df_tax)
    logging.info('add uniprot')
    df_prot = df[df['domain'] == 'UniProt']
    loader.load_uniprot_terms(df_prot)
    logging.info('add lifelike terms')
    df_ll = df[df['domain'] == 'Lifelike']
    loader.load_lifelike_terms_with_datasource(df_ll[df_ll['data_source'].str.len() > 0])
    loader.load_lifelike_terms_without_datasource(df_ll[df_ll['data_source'].str.len() == 0])


if __name__ == '__main__':
    # database = get_database(Neo4jInstance.LOCAL)
    database = get_database(Neo4jInstance.GOOGLE_PROD)
    add_global_inclusion_test_file('Global Inclusion Test File for Robin v2.xlsx', database)
    database.close()
