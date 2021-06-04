from neo4j import GraphDatabase
from common.database import *
from common.constants import *
from common import utils
import pandas as pd
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s',
                    handlers=[logging.StreamHandler()])

KG_DOMAINS = [DB_NCBI, DB_MESH, DB_UNIPROT]

"""
LL-3096
Load the file to neo4j-staging only (for test). 
"""
def add_global_inclusion_test_file(database:Database, file):
    """
    :return:
    """
    filepath = os.path.join(utils.get_data_dir(), file)
    columns = ['domain', 'data_source', 'external_id', 'name', 'type', 'hyperlink', 'inclusion_date', 'user']
    df = pd.read_excel(filepath, names=columns)
    df = df.astype('str')
    df = df.replace('nan', '')
    # df_mesh = df[df['domain']=='MESH']
    # load_mesh_terms(database, df_mesh)
    # df_gene = df[df['data_source'] == 'NCBI Gene']
    # load_ncbigene_terms(database, df_gene)
    # df_tax = df[df['data_source'] == 'NCBI Taxonomy']
    # load_taxonomy_terms(database, df_tax)
    # df_prot = df[df['domain']=='UniProt']
    # load_uniprot_terms(database, df_prot)
    df_ll = df[df['domain'] == 'Lifelike']
    load_lifelike_terms_with_datasource(database, df_ll[df_ll['data_source'].str.len() > 0])
    load_lifelike_terms_without_datasource(database,  df_ll[df_ll['data_source'].str.len() == 0])

def load_mesh_terms(database:Database, df:pd.DataFrame):
    query = """
    with $dict.rows as rows unwind rows as row
    match (n:db_MESH) where n.id = 'MESH:' + row.external_id
    set n.entity_type = row.type, n.inclusion_date = apoc.date.parseAsZonedDateTime(row.inclusion_date), n.user = row.user 
    merge (s:Synonym {name:row.name}) 
    merge (n)-[r:HAS_SYNONYM]->(s) set r.inclusion_date = n.inclusion_date, r.user = n.user
    """
    database.load_data_from_dataframe(df, query)


def load_ncbigene_terms(database:Database, df:pd.DataFrame):
    query = """
    with $dict.rows as rows unwind rows as row
    match (n:Gene) where n.id = row.external_id
    set n.inclusion_date = apoc.date.parseAsZonedDateTime(row.inclusion_date), n.user = row.user 
    merge (s:Synonym {name:row.name}) 
    merge (n)-[r:HAS_SYNONYM]->(s) set r.inclusion_date = n.inclusion_date, r.user = n.user
    """
    database.load_data_from_dataframe(df, query)


def load_taxonomy_terms(database:Database, df:pd.DataFrame):
    query = """
    with $dict.rows as rows unwind rows as row
    match (n:Taxonomy) where n.id = trim(row.external_id)
    set n.entity_type = row.type, n.inclusion_date = apoc.date.parseAsZonedDateTime(row.inclusion_date), n.user = row.user 
    merge (s:Synonym {name:row.name}) 
    merge (n)-[r:HAS_SYNONYM]->(s) set r.inclusion_date = n.inclusion_date, r.user = n.user
    """
    database.load_data_from_dataframe(df, query)

def load_uniprot_terms(database:Database, df:pd.DataFrame):
    query = """
    with $dict.rows as rows unwind rows as row
    match (n:db_UniProt) where n.id = row.external_id
    set n.inclusion_date = apoc.date.parseAsZonedDateTime(row.inclusion_date), n.user = row.user 
    merge (s:Synonym {name:row.name}) 
    merge (n)-[r:HAS_SYNONYM]->(s) set r.inclusion_date = n.inclusion_date, r.user = n.user
    """
    database.load_data_from_dataframe(df, query)


def load_lifelike_terms_with_datasource(database:Database, df:pd.DataFrame):
    query = """
    with $dict.rows as rows unwind rows as row
    merge (n:db_Lifelike {id:row.data_source + ':' + row.external_id}) 
    set n.data_source = row.data_source, n.external_id = row.external_id, n.name = row.name, n.entity_type = row.type, 
    n.hyperlink = row.hyperlink, n.inclusion_date = apoc.date.parseAsZonedDateTime(row.inclusion_date), n.user = row.user
    """
    database.load_data_from_dataframe(df, query)

def load_lifelike_terms_without_datasource(database:Database, df:pd.DataFrame):
    query = """
    with $dict.rows as rows unwind rows as row
    merge (n:db_Lifelike {id:'Lifelike:' + row.name}) 
    set n.name = row.name, n.entity_type = row.type, 
    n.inclusion_date = apoc.date.parseAsZonedDateTime(row.inclusion_date), n.user = row.user
    """
    database.load_data_from_dataframe(df, query)

def create_indexes(database:Database):
    database.create_index(NODE_GENE, 'inclusion_date', 'index_gene_inclusiondate')
    database.create_index(NODE_TAXONOMY, 'inclusion_date', 'index_taxonomy_inclusiondate')

if __name__ == '__main__':
    # database = get_database(Neo4jInstance.LOCAL)
    database = get_database(Neo4jInstance.GOOGLE_STG)
    add_global_inclusion_test_file(database, 'Global Inclusion Test File for Robin v2.xlsx')
    create_indexes(database)
    database.close()
