from marshmallow import fields, validate

from neo4japp.database import ma


class NodeAssociatedTypesRequest(ma.Schema):
    node_id = ma.Integer(required=True)
    to_label = ma.String(required=True)


class GetSnippetsForNodePairRequest(ma.Schema):
    from_id = ma.Integer(required=True)
    to_id = ma.Integer(required=True)
    page = ma.Integer(required=True)
    limit = ma.Integer(required=True)
