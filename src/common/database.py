from common.query_builder import *
from neo4j import GraphDatabase, ResultSummary
from neo4j.exceptions import Neo4jError
from enum import Enum
import pandas as pd
import logging
import os


def get_database():
    """
    Get database instance based on environment variables
    :return: database instance
    """
    uri = os.environ.get("NEO4J_INSTANCE_URI")
    dbname = os.environ.get("NEO4J_DATABASE_NAME")
    username = os.environ.get("NEO4J_USERNAME")
    pwd = os.environ.get("NEO4J_PWD")
    driver = GraphDatabase.driver(uri, auth=(username, pwd))
    return Database(driver, dbname)


class Database:
    def __init__(self, driver: GraphDatabase, dbname: str):
        self.driver = driver
        self.dbname = dbname
        self.logger = logging.getLogger(__name__)

    def close(self):
        self.driver.close()

    def create_database(self, database_name):
        with self.driver.session() as session:
            query = get_create_database_query(database_name)
            info = session.run(query).consume()
            self.logger(info.counters)

    def create_constraint(self, label: str, property_name: str, constraint_name=""):
        """
        Create neo4j constraint
        :param label: node label
        :param property_name: node property
        :param constrain_name: the name for the constraint (optional)
        """
        if not constraint_name:
            constraint_name = 'constraint_' + label.lower() + '_' + property_name
        query = get_create_constraint_query(label, property_name, constraint_name)
        self.logger.debug(query)
        with self.driver.session(database=self.dbname) as session:
            try:
                session.run(query)
            except Exception as error:
                self.logger.error("Could not create constraint %r. %r", constraint_name, error)

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
            except Exception as error:
                self.logger.error("Could not create index %r. %r", index_name, error)

    def create_fulltext_index(self, index_name, node_labels:[], index_properties:[]):
        query = get_create_fulltext_index_query()
        with self.driver.session(database=self.dbname) as session:
            try:
                session.run(query, indexName=index_name, labels=node_labels, properties=index_properties)
            except Exception as error:
                self.logger.error("Could not create index %r. %r", index_name, error)

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
                self.logger.error(ex.message)

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
            self.logger.info(result.counters)

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
                self.logger.info("Rows processed:" + str(len(data_frame)))
            else:
                rows_dict = {'rows': data_frame.fillna(value="").to_dict('records')}
                result = session.run(query, dict=rows_dict).consume()
                self.logger.info(result.counters)

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
        self.logger.info("Load file: " + data_file)
        self.logger.info("Query: " + query)
        with self.driver.session(database=self.dbname) as session:
            if not chunk_size:
                df = data_chunk
                rows_dict = {'Rows': df.fillna(value="").to_dict('records')}
                result = session.run(query, dict=rows_dict).consume()
                self.logger.info(result.counters)
            else:
                for i, rows in enumerate(data_chunk):
                    count = count + len(rows)
                    rows_dict = {'rows': rows.fillna(value="").to_dict('records')}
                    result = session.run(query, dict=rows_dict).consume()
                    # self.logger.info(result.counters)
                self.logger.info("Rows processed: " + str(count))



