from marshmallow import fields

from neo4japp.schemas.base import CamelCaseSchema


class UserSchema(CamelCaseSchema):
    hash_id = fields.String()
    username = fields.String()
    first_name = fields.String()
    last_name = fields.String()