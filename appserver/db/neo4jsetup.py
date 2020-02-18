""" Configuration for NEO4J Database """
from py2neo import GraphError
from neo4japp.constants import *

def setup():
    from app import app
    from neo4japp import graph

    with app.app_context():
        print('Dropping any previous full text search indexes.')
        graph.begin()
        labels = [TYPE_CHEMICAL, TYPE_DISEASE, TYPE_GENE, TYPE_TAXONOMY]
        drop_index_queries = [f'DROP INDEX ON :{label}(name)' for label in labels]

        try:
            for drop_query in drop_index_queries:
                graph.evaluate(drop_query)
        except GraphError:
            print('WARNING: No previous indexes found. Continuing...')

        print('Setting up full text search indexes.')
        create_index_queries = [
            f'CALL db.createIndex(":{label}(name)", "native-btree-1.0")'
            for label in labels
        ]

        try:
            for create_query in create_index_queries:
                graph.evaluate(create_query)
        except GraphError:
            print('WARNING: Fulltext indexing failed.')

        print('Fulltext search index setup complete.')

if __name__ == '__main__':
    setup()
