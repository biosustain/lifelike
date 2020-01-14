from neo4japp.services.common import BaseDao


class Neo4JService(BaseDao):
    def __init__(self, graph_session):
        super().__init__(graph_session)

    def execute_cypher(self, query):
        # TODO: Sanitize the queries
        result = self.graph_session.run(query)
        for record in result:
            print(record)
