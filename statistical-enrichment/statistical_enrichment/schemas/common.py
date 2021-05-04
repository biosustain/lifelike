from marshmallow import fields

from .base import CamelCaseSchema


class ErrorResponseSchema(CamelCaseSchema):
    """All errors are emitted with this schema."""
    title = fields.String()
    message = fields.String()
    additional_msgs = fields.List(fields.String())
    stacktrace = fields.String()
    code = fields.Integer()
    version = fields.String()
    transaction_id = fields.String()
    fields_ = fields.Dict(
            keys=fields.String(),
            values=fields.Raw(),  # raw means can be anything
            attribute='fields', allow_none=True)
