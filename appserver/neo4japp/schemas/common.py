import marshmallow.validate
from marshmallow import fields

from neo4japp.schemas.base import CamelCaseSchema


class PaginatedRequest(CamelCaseSchema):
    page = fields.Integer(required=False,
                          missing=lambda: 1,
                          validate=marshmallow.validate.Range(min=1, max=10000))
    limit = fields.Integer(required=False,
                           missing=lambda: 50,
                           validate=marshmallow.validate.Range(min=1, max=1000))


class FileUploadField(fields.Field):
    pass
    # TODO: validate
