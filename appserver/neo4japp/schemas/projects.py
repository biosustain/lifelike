import marshmallow.validate
from marshmallow import fields

from neo4japp.schemas.account import UserSchema
from neo4japp.schemas.base import CamelCaseSchema
from neo4japp.schemas.common import ResultListSchema

accepted_role_names = ['project-read', 'project-write', 'project-admin']


# ========================================
# Collaborators
# ========================================

class ProjectCollaboratorSchema(CamelCaseSchema):
    user = fields.Nested(UserSchema)
    role_name = fields.String()


class ProjectCollaboratorResponseSchema(ResultListSchema):
    result = fields.Nested(ProjectCollaboratorSchema)


class ProjectCollaboratorListSchema(ResultListSchema):
    results = fields.List(fields.Nested(ProjectCollaboratorSchema))


# Requests
# ----------------------------------------

class ProjectCollaboratorUpdateOrCreateRequest(CamelCaseSchema):
    user_hash_id = fields.String(required=True)
    role_name = fields.String(required=True, validate=marshmallow.validate.OneOf(
        accepted_role_names
    ))
