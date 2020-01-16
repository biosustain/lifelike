from neo4japp.services.common import BaseDao
from neo4japp.models import GraphNode, GraphRelationship

class Neo4JService(BaseDao):
    def __init__(self, graph_session):
        super().__init__(graph_session)

    def execute_cypher(self, query):
        # TODO: Sanitize the queries
        records = self.graph_session.run(query).data()
        if not records:
            return None
        node_dict = dict()
        rel_dict = dict()
        for record in records:
            graph_node = GraphNode.from_py2neo(record['node'])
            node_dict[graph_node.id] = graph_node
            graph_rel = GraphRelationship.from_py2neo(record['relationship'])
            rel_dict[graph_rel.id] = graph_rel
        return dict(nodes=[n.to_dict() for n in node_dict.values()],
                    edges=[r.to_dict() for r in rel_dict.values()])
