""" Configuration for NEO4J Database """
from py2neo import GraphError

def setup():
    from app import app
    from neo4japp import graph

    with app.app_context():
        print('Dropping any previous full text search indexes.')
        drop_query = """
        CALL db.index.fulltext.drop("names")
        """
        try:
            graph.run(drop_query)
        except GraphError:
            print('No previous indexes found. Continuing...')

        print('Setting up full text search indexes.')
        query = """
        CALL db.index.fulltext.createNodeIndex(
            "names", ["Disease", "Chemical", "Gene", "Taxonomy"], ["name"])
        """
        graph.run(query)
        print('Fulltext search index setup complete.')

if __name__ == '__main__':
    setup()
