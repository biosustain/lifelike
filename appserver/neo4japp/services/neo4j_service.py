from py2neo import NodeMatcher, RelationshipMatcher
from neo4japp.services.common import BaseDao
from neo4japp.models import GraphNode, GraphRelationship
from neo4japp.constants import *

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

    # TODO: Use snake to camel util method to fix payload
    def get_organisms(self):
        nodes = list(NodeMatcher(self.graph_session).match(NODE_SPECIES))
        organisms = [dict(
            id=node[PROP_BIOCYC_ID],
            data=dict(organism_name=node['common_name']),
            label=NODE_SPECIES,
            display_name=node['common_name'],
            sub_labels=[l for l in node.labels if l not in [DB_BIOCYC, NODE_SPECIES]],
        ) for node in nodes]
        return organisms
