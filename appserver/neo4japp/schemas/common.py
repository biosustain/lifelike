import traceback

from typing import Any

import attr
import marshmallow.validate
from flask import current_app
from marshmallow import post_load, fields

from neo4japp.schemas.base import CamelCaseSchema
from neo4japp.schemas.fields import StringIntegerField
from neo4japp.utils.globals import warnings, info
from neo4japp.util import CamelDictMixin
from neo4japp.utils.request import Pagination


class PaginatedRequestSchema(CamelCaseSchema):
    page = StringIntegerField(
        required=False,
        missing=lambda: 1,
        validate=marshmallow.validate.Range(min=1, max=10000),
    )
    limit = StringIntegerField(
        required=False,
        missing=lambda: 50,
        validate=marshmallow.validate.Range(min=1, max=1000),
    )

    @post_load
    def create(self, params, **kwargs):
        return Pagination(page=params['page'], limit=params['limit'])


class RankedItemSchema(CamelCaseSchema):
    """When you need to assign a rank to each item."""

    rank = fields.Number()
    # item = YourField()


class ResultQuerySchema(CamelCaseSchema):
    phrases = fields.List(fields.String)


class SingleResultSchema(CamelCaseSchema):
    """When you have one item to return."""

    # result = YourField()


class ResultListSchema(CamelCaseSchema):
    """When you have a list of items to return."""

    total = fields.Integer()
    query = fields.Nested(ResultQuerySchema)
    # results = fields.List(YourField())


class ResultMappingSchema(CamelCaseSchema):
    """When you have a key -> value map to return."""

    missing = fields.List(fields.String)
    # mapping = fields.Dict(YourField(), YourField())


# Note: The above schemas (SingleResult, ResultList, ResultMapping) have field names
# named in a way that lets you combine the schemas without conflicts!
# (i.e. ResultList + ResultMapping in the same response)


class BaseResponseSchema(CamelCaseSchema):
    """All status responses are emitted with this schema."""

    title = fields.String()
    type = fields.String()
    message = fields.String()
    additional_msgs = fields.List(fields.String())
    code = fields.Integer()
    transaction_id = fields.String()
    fields_ = fields.Dict(
        keys=fields.String(),
        values=fields.Raw(),  # raw means can be anything
        attribute='fields',
        allow_none=True,
    )
    version = fields.Method('get_version')

    def get_version(self, ex):
        return current_app.config.get('GITHUB_HASH')

    stacktrace = fields.Method('get_stacktrace')

    def get_stacktrace(self, ex):
        if current_app.config.get('FORWARD_STACKTRACE'):
            return ''.join(
                traceback.format_exception(
                    etype=type(ex), value=ex, tb=ex.__traceback__
                )
            )

    cause = fields.Method('get_cause')

    def get_cause(self, e):
        if isinstance(e.__cause__, BaseResponseSchema):
            return BaseResponseSchema().dump(e.__cause__)


class ErrorResponseSchema(BaseResponseSchema):
    """All errors are emitted with this schema."""

    pass


class WarningResponseSchema(ErrorResponseSchema):
    """All warnings are emitted with this schema."""

    pass


class InformationResponseSchema(BaseResponseSchema):
    """All information messages are emitted with this schema."""

    pass


class WarningSchema(CamelCaseSchema):
    warnings = fields.Method('get_warnings')

    def get_warnings(self, obj):
        return [WarningResponseSchema().dump(w) for w in warnings]


class InformationSchema(CamelCaseSchema):
    info = fields.Method('get_info')

    def get_info(self, obj):
        return [InformationResponseSchema().dump(i) for i in info]


@attr.s(frozen=True)
class SuccessResponse(CamelDictMixin, WarningSchema):
    # result: Union[ReconBase, CamelDictMixin, List[Union[ReconBase, CamelDictMixin]], str, bool]
    result: Any = attr.ib()
    status_code: int = attr.ib(validator=attr.validators.instance_of(int))
