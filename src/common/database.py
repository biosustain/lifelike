from common.query_builder import *
from neo4j import GraphDatabase, ResultSummary
from neo4j.exceptions import Neo4jError
from enum import Enum
import pandas as pd
import logging
import os

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s',
                    handlers=[logging.StreamHandler()])

STG_URI = 'bolt://34.67.212.125:7687'
STG_PASSWORD = 'lifelike-stg-2021'

PROD_URI = 'bolt://35.225.248.203:7687'
PROD_PASSWORD = 'Lifelike0.9prod'

LOCAL_URI = 'bolt://localhost:7687'
LOCAL_PASSWORD = os.environ.get('NEO4J_LOCAL_PASSWORD', 'rcai')

DTU_URI = "bolt+s://neo4j.lifelike.bio:7687"
DTU_USER = "robin"
DTU_PWD = "kTxu$drJ%3C3^cHk"

protocols = ['bolts', 'bolt+s', 'bolt+ssc', 'https', 'http+s', 'http+ssc']


class Neo4jInstance(Enum):
    GOOGLE_STG = 'google staging dataase'
    GOOGLE_PROD = 'google prod database'
    DTU = 'dtu neo4j'
    LOCAL = 'local host'


def get_database(neo4j: Neo4jInstance, dbname='neo4j'):
    """
    Get database instance with pre-set KG connections
    :param neo4j: preset Neo4jInstance
    :param dbname: graphdb name to use (for the neo4j instance), e.g. lifelike, lifelike-stg, reactome
    :return: database instance
    """
    if neo4j == Neo4jInstance.GOOGLE_STG:
        driver = GraphDatabase.driver(STG_URI, auth=('neo4j', STG_PASSWORD))
    elif neo4j == Neo4jInstance.GOOGLE_PROD:
        driver = GraphDatabase.driver(PROD_URI, auth=('neo4j', PROD_PASSWORD))
    elif neo4j == Neo4jInstance.DTU:
        driver = GraphDatabase.driver(DTU_URI, auth=(DTU_USER, DTU_PWD))
    else:
        driver = GraphDatabase.driver(LOCAL_URI, auth=('neo4j', LOCAL_PASSWORD))
    return Database(driver, dbname)


class Database:
    def __init__(self, driver: GraphDatabase, dbname: str):
        self.driver = driver
        self.dbname = dbname

    def close(self):
        self.driver.close()

    def create_database(self, database_name):
        with self.driver.session() as session:
            query = get_create_database_query(database_name)
            info = session.run(query).consume()
            logging(info.counters)

    def create_constraint(self, label: str, property_name: str, constrain_name=''):
        """
        Create neo4j constraint
        :param label: node label
        :param property_name: node property
        :param constrain_name: the name for the constraint (optional)
        """
        if not constrain_name:
            constrain_name = 'constraint_' + label.lower() + '_' + property_name
        query = get_create_constraint_query(label, property_name, constrain_name)
        print(query)
        with self.driver.session(database=self.dbname) as session:
            try:
                session.run(query)
            except Neo4jError:
                logging.warning('constrain already exists: ' + query)

    def create_index(self, label: str, property_name, index_name=''):
        """
        Create neo4j index
        :param label: node label
        :param property_name: node property
        :param index_name: the name for the index (optional)
        """
        if not index_name:
            index_name = 'index_' + label.lower() + '_' + property_name
        query = get_create_index_query(label, property_name, index_name)
        with self.driver.session(database=self.dbname) as session:
            try:
                session.run(query)
            except Neo4jError:
                logging.warning('index already exists: ' + query)

    def create_fulltext_index(self, index_name, node_labels:[], index_properties:[]):
        query = get_create_fulltext_index_query()
        with self.driver.session(database=self.dbname) as session:
            try:
                session.run(query, indexName=index_name, labels=node_labels, properties=index_properties)
            except Neo4jError:
                logging.warning('index already exists: ' + index_name)

    def run_query(self, query, params: dict = None):
        """
        Run query with parameter dict in the format {'rows': []}. Each row is a dict of prop_name-value pairs.
        e.g. for $dict = {'rows':[{'id': '123a', 'name':'abc'}, {'id':'456', 'name': 'xyz'}]}, the id_name should be 'id',
        and properties=['name']
        :param query: the cypher query with $dict parameter (see query_builder.py)
        :param params: the parameter in the format as described
        :return: None
        """
        with self.driver.session(database=self.dbname) as session:
            try:
                result = session.run(query, params).consume()
                logging.info(result.counters)
            except Neo4jError as ex:
                logging.error(ex.message)

    def get_data(self, query:str, params: dict = {}) -> pd.DataFrame:
        """
        Run query to get data as dataframe
        :param query: the query with parameter $dict (see query_builder.py)
        :param params: value passed to $dict, in format {'rows':[]} where the [] is a list of prop_name-value pairs.
        :return: dataframe for the result
        """
        with self.driver.session(database=self.dbname) as session:
            results = session.run(query, params)
            # df = pd.DataFrame([dict(record) for record in results])
            df = pd.DataFrame(results.values(), columns=results.keys())
        return df

    def load_data_from_rows(self, query: str, data_rows: []):
        """
        run the query by passing data rows
        :param query: the query with $dict parameter (see query_builder.py)
        :param data_rows: list of dict that can get from a dataframe as rows = dataframe.to_dict('records')
        :return: none
        """
        with self.driver.session(database=self.dbname) as session:
            rows_dict = {'rows': data_rows}
            result = session.run(query, dict=rows_dict).consume()
            logging.info(result.counters)

    def load_data_from_dataframe(self, data_frame: pd.DataFrame, query: str, chunksize=None):
        """
        Run query by passing dataframe
        :param data_frame: the dataframe to load
        :param query: the query with $dict parameter (see query_builder.py)
        :param chunksize: if set, the dataframe will be loaded in chunks.
        :return: none
        """
        with self.driver.session(database=self.dbname) as session:
            if chunksize:
                chunks = [data_frame[i:i + chunksize] for i in range(0, data_frame.shape[0], chunksize)]
                for chunk in chunks:
                    rows_dict = {'rows': chunk.fillna(value="").to_dict('records')}
                    session.run(query, dict=rows_dict)
                logging.info('rows processed:' + str(len(data_frame)))
            else:
                rows_dict = {'rows': data_frame.fillna(value="").to_dict('records')}
                result = session.run(query, dict=rows_dict).consume()
                logging.info(result.counters)

    def load_csv_file(self, data_file: str, col_names:[], query: str, skip_lines=0, separator='\t',
                      chunk_size=2000, apply_str_columns=[]):
        """
        load csv file to neo4j database
        :param data_file: path to the file
        :param col_names: file headers (match database properties)
        :param query:  the query with $dict parameter (see query_builder.py)
        :param skip_lines: number of rows skipped for reading
        :param separator: csv file delimiter
        :param chunk_size: number of rows to read for each chunk
        :param apply_str_columns: columns to convert values to str, e.g. gene_id, tax_id
        :return:
        """
        # converters = {}
        # f = lambda x: str(x)
        # if apply_str_columns:
        #     for col in apply_str_columns:
        #         converters[col] = f
        dtype_map = {}
        if apply_str_columns:
            for col in apply_str_columns:
                dtype_map[col] = str
        data_chunk = pd.read_csv(data_file, sep=separator, header=None, names=col_names, chunksize=chunk_size,
                                 dtype=dtype_map, skiprows=skip_lines, index_col=False,
                                 low_memory=False, engine='c', na_filter=False)
        count = 0
        logging.info("load file: " + data_file)
        logging.info("query: " + query)
        with self.driver.session(database=self.dbname) as session:
            if not chunk_size:
                df = data_chunk
                rows_dict = {'rows': df.fillna(value="").to_dict('records')}
                result = session.run(query, dict=rows_dict).consume()
                logging.info(result.counters)
            else:
                for i, rows in enumerate(data_chunk):
                    count = count + len(rows)
                    rows_dict = {'rows': rows.fillna(value="").to_dict('records')}
                    result = session.run(query, dict=rows_dict).consume()
                    # logging.info(result.counters)
                logging.info('rows processed: ' + str(count))



