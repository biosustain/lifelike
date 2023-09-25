from enum import Enum

import marshmallow
from marshmallow import fields

from neo4japp.schemas.base import CamelCaseSchema


# These schema definitions should be always in sync with client ones in:
# client/src/app/admin/services/chatgpt-usage.service.ts


class Interval(Enum):
    minute = 'minute'
    hour = 'hour'
    day = 'day'
    week = 'week'
    month = 'month'
    year = 'year'

    @classmethod
    def list(cls):
        return list(map(lambda c: c.value, cls))


class ChatGPTUsageQuery(CamelCaseSchema):
    start = fields.Integer(required=True, comment='Unix timestamp in seconds')
    interval = fields.String(
        required=False, validate=marshmallow.validate.OneOf(Interval.list())
    )
    end = fields.Integer(required=False, comment='Unix timestamp in seconds')


class ChatGPTUsageRecord(CamelCaseSchema):
    start = fields.Integer(required=True, comment='Unix timestamp in seconds')
    value = fields.Integer(required=True, comment='Total tokens used')
    end = fields.Integer(required=False, comment='Unix timestamp in seconds')


class ChatGPTUsageResponse(CamelCaseSchema):
    results = fields.List(fields.Nested(ChatGPTUsageRecord()), required=True)
    query = fields.Nested(ChatGPTUsageQuery(), required=True)
