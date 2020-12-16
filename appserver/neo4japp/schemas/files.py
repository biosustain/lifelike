from marshmallow import fields
import marshmallow.validate

from neo4japp.models.files import FileLock
from neo4japp.schemas.base import CamelCaseSchema
from neo4japp.schemas.account import UserSchema


class FileLockSchema(CamelCaseSchema):
    user = fields.Nested(UserSchema)
    acquire_date = fields.DateTime()
    own = fields.Method('get_own')

    def get_own(self, obj: FileLock):
        return self.context['current_user'].id == obj.user.id


class FileLockCreateRequest(CamelCaseSchema):
    own = fields.Boolean(required=True, validate=marshmallow.validate.OneOf([True]))


class FileLockDeleteRequest(CamelCaseSchema):
    own = fields.Boolean(required=True, validate=marshmallow.validate.OneOf([True]))


class FileLockListResponse(CamelCaseSchema):
    results = fields.List(fields.Nested(FileLockSchema))
    total = fields.Integer()
