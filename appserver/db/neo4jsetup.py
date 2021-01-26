""" Configuration for NEO4J Database """
from py2neo.database.work import ClientError
from neo4japp.constants import *


def setup():
    from app import app
    from neo4japp.database import connect_to_neo4j

    with app.app_context():
        print('Dropping any previous full text search indexes.')
        graph = connect_to_neo4j()
        tx = graph.begin()
        drop_fts_index_query = 'CALL db.index.fulltext.drop("namesEvidenceAndId")'
        try:
            graph.evaluate(drop_fts_index_query)
        except ClientError:
            print('WARNING: No previous indexes found. Continuing...')

        labels = [TYPE_GENE, TYPE_DISEASE, TYPE_TAXONOMY, TYPE_CHEMICAL, TYPE_SNIPPET]
        indexed_properties = ['name', 'id', 'sentence']
        create_fts_index_query = """
            CALL db.index.fulltext.createNodeIndex(
                "namesEvidenceAndId", [{}], [{}]
            )
        """.format(
            ','.join([f'"{label}"' for label in labels]),
            ','.join([f'"{prop}"' for prop in indexed_properties])
        )
        print(create_fts_index_query)

        print('Setting up full text search indexes.')
        try:
            graph.evaluate(create_fts_index_query)
        except ClientError:
            print('WARNING: Fulltext indexing failed.')
        tx.commit()
        print('Fulltext search index setup complete.')


if __name__ == '__main__':
    setup()
