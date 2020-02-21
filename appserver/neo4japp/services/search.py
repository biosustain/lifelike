from neo4japp.services.common import BaseDao
from neo4japp.models import GraphNode

class SearchService(BaseDao):

    def __init__(self, graph):
        super().__init__(graph)

    def prefix_search(self, term: str):
        query = """
            MATCH (c:Chemical)
            WHERE c.name STARTS WITH $search_term
            RETURN c AS node
            UNION
            MATCH (d:Disease)
            WHERE d.name STARTS WITH $search_term
            RETURN d AS node
            UNION
            MATCH (g:Gene)
            WHERE g.name STARTS WITH $search_term
            RETURN g AS node
            UNION
            MATCH (t:Taxonomy)
            WHERE t.name STARTS WITH $search_term
            RETURN t as node
        """
        records = self.graph.run(query, parameters={'search_term': term.strip()}).data()
        nodes = [GraphNode.from_py2neo(n['node'], display_fn=lambda x: x.get('name')) for n in records]
        return dict(nodes=[n.to_dict() for n in nodes], edges=[])