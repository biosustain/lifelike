import marshmallow.validate
from marshmallow import post_load, fields

from neo4japp.schemas.base import CamelCaseSchema
from neo4japp.schemas.fields import StringIntegerField
from neo4japp.utils.request import Pagination


class PaginatedRequestSchema(CamelCaseSchema):
    page = StringIntegerField(required=False,
                              missing=lambda: 1,
                              validate=marshmallow.validate.Range(min=1, max=10000))
    limit = StringIntegerField(required=False,
                               missing=lambda: 50,
                               validate=marshmallow.validate.Range(min=1, max=1000))

    @post_load
    def create(self, params, **kwargs):
        return Pagination(page=params['page'], limit=params['limit'])


class RankedItemSchema(CamelCaseSchema):
    rank = fields.Number()


class SingleResultSchema(CamelCaseSchema):
    pass


class ResultQuerySchema(CamelCaseSchema):
    phrases = fields.List(fields.String)


class ResultListSchema(CamelCaseSchema):
    total = fields.Integer()
    query = fields.Nested(ResultQuerySchema)


class ResultMappingSchema(CamelCaseSchema):
    missing = fields.List(fields.String)


class ErrorResponseSchema(CamelCaseSchema):
    message = fields.String()
    detail = fields.String()
    code = fields.String()
    api_http_error = fields.String()
    version = fields.String()
    transaction_id = fields.String()
    fields_ = fields.Dict(fields.String(), fields.List(fields.String()), attribute="fields")
