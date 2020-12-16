import marshmallow.validate
from marshmallow import fields, post_load

from neo4japp.schemas.base import CamelCaseSchema
from neo4japp.schemas.fields import StringIntegerField
from neo4japp.utils.request import Pagination


class PaginatedRequest(CamelCaseSchema):
    page = StringIntegerField(required=False,
                              missing=lambda: 1,
                              validate=marshmallow.validate.Range(min=1, max=10000))
    limit = StringIntegerField(required=False,
                               missing=lambda: 50,
                               validate=marshmallow.validate.Range(min=1, max=1000))

    @post_load
    def create(self, params, **kwargs):
        return Pagination(page=params['page'], limit=params['limit'])


class FileUploadField(fields.Field):
    pass
    # TODO: validate
