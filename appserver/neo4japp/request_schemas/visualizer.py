from marshmallow import fields, validate

from neo4japp.database import ma


class AssociatedTypeSnippetCountRequest(ma.Schema):
    source_node = ma.Integer(required=True)
    associated_nodes = ma.List(ma.Integer(required=True))
    label = ma.String(required=True)


class GetSnippetsForNodePairRequest(ma.Schema):
    from_id = ma.Integer(required=True)
    to_id = ma.Integer(required=True)
    page = ma.Integer(required=True)
    limit = ma.Integer(required=True)
