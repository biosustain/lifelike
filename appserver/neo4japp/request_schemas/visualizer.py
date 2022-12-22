from neo4japp.database import ma


class AssociatedTypeSnippetCountRequest(ma.Schema):
    source_node = ma.String(required=True)
    associated_nodes = ma.List(ma.String(required=True))


class GetSnippetsForNodePairRequest(ma.Schema):
    # Note that we avoid using "from" and "to" terminology here since we can't be sure there aren't
    # bidirectional relationships between these two nodes
    node_1_id = ma.String(required=True)
    node_2_id = ma.String(required=True)
    page = ma.Integer(required=True)
    limit = ma.Integer(required=True)
