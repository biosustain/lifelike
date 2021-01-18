import marshmallow.validate

from neo4japp.schemas.base import CamelCaseSchema
from neo4japp.schemas.fields import StringIntegerField


class PaginatedRequestSchema(CamelCaseSchema):
    page = StringIntegerField(required=False,
                              missing=lambda: 1,
                              validate=marshmallow.validate.Range(min=1, max=10000),
                              as_string=True)
    limit = StringIntegerField(required=False,
                               missing=lambda: 50,
                               validate=marshmallow.validate.Range(min=1, max=1000),
                               as_string=True)
