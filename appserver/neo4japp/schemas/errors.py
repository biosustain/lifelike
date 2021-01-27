from marshmallow import fields
from neo4japp.schemas.base import CamelCaseSchema


class ClientErrorSchema(CamelCaseSchema):
    title = fields.String()
    message = fields.String()
    detail = fields.String()
    transaction_id = fields.String()
    url = fields.String()
    label = fields.String()
    expected = fields.Boolean()
