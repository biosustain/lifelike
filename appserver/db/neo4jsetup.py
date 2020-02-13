""" Configuration for NEO4J Database """

def setup():
    from app import app
    from neo4japp import graph

    with app.app_context():
        print('Setting up full text search indexes.')
        query = """
        CALL db.index.fulltext.createNodeIndex(
            "names", ["Disease", "Chemical", "Gene", "Taxonomy"], ["name"])
        """
        graph.run(query)
        print('Fulltext search index setup complete.')

if __name__ == '__main__':
    setup()
