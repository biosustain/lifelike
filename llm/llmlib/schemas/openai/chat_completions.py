from marshmallow import fields, Schema, validate

from ..fields import UnionType
from .completions_base import CompletionsBaseRequestSchema


class MessageSchema(Schema):
    role = fields.String(
        validate=fields.validate.OneOf(['system', 'user', 'assistant', 'function']),
        required=True,
    )
    content = fields.String(nullable=True, required=True)
    name = fields.String()
    function_call = fields.Dict()


class FunctionSchema(Schema):
    name = fields.String(required=True)
    description = fields.String()
    parameters = fields.Dict(keys=fields.String(), values=fields.Raw(), required=True)


class ChatCompletionsRequestSchema(CompletionsBaseRequestSchema):
    model = fields.String(required=True)
    messages = fields.List(fields.Nested(MessageSchema()), required=True)
    functions = fields.List(fields.Nested(FunctionSchema()))
    function_call = UnionType(
        types=(
            fields.String(validate=validate.OneOf(('none', 'all'))),
            fields.Dict(
                keys=fields.String(),
                values=fields.String(),
            ),
        ),
    )
