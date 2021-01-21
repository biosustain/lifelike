import marshmallow.validate
from marshmallow import fields

from neo4japp.schemas.base import CamelCaseSchema
from neo4japp.schemas.common import ResultListSchema


# ========================================
# Users
# ========================================

class UserSchema(CamelCaseSchema):
    """Generic schema for returning public information about a user."""
    hash_id = fields.String()
    username = fields.String()
    first_name = fields.String()
    last_name = fields.String()
    # DO NOT return private information (like email) in this schema


# Requests
# ----------------------------------------

class UserSearchSchema(CamelCaseSchema):
    """Used to search for users (i.e. user auto-complete)."""
    query = fields.String(required=True, validate=[
        marshmallow.validate.Length(min=1, max=100),
        marshmallow.validate.Regexp('[^\\s]+')
    ])
    exclude_self = fields.Boolean(missing=lambda: False)


# Responses
# ----------------------------------------

class UserListSchema(ResultListSchema):
    """A list of users."""
    results = fields.List(fields.Nested(UserSchema))
