import marshmallow.validate
from marshmallow import fields

from neo4japp.schemas.base import CamelCaseSchema
from neo4japp.schemas.common import ResultListSchema


# ========================================
# Users
# ========================================

class UserSchema(CamelCaseSchema):
    hash_id = fields.String()
    username = fields.String()
    first_name = fields.String()
    last_name = fields.String()


# Requests
# ----------------------------------------

class UserSearchSchema(CamelCaseSchema):
    query = fields.String(required=True, validate=[
        marshmallow.validate.Length(min=1, max=100),
        marshmallow.validate.Regexp('[^\\s]+')
    ])
    exclude_self = fields.Boolean(missing=lambda: False)


# Responses
# ----------------------------------------

class UserListSchema(ResultListSchema):
    results = fields.List(fields.Nested(UserSchema))
