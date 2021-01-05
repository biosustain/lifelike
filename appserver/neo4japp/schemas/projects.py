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

class ProjectCollaboratorUpdateSchema(CamelCaseSchema):
    user_hash_id = fields.String(required=True)
    role_name = fields.String(required=True, validate=marshmallow.validate.OneOf(
        accepted_role_names
    ))


class ProjectMultiCollaboratorUpdateRequest(CamelCaseSchema):
    update_or_create = fields.List(fields.Nested(ProjectCollaboratorUpdateSchema),
                                   missing=lambda: [],
                                   validate=marshmallow.validate.Length(max=5))
    remove_user_hash_ids = fields.List(fields.String(), missing=lambda: [],
                                       validate=marshmallow.validate.Length(max=5))
