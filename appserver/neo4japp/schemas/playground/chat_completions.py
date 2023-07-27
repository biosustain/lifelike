import marshmallow
from marshmallow import fields

from neo4japp.schemas.base import CamelCaseSchema
from neo4japp.schemas.fields import UnionType
from neo4japp.schemas.validators import DeferedOneOf, JSONSchema
from neo4japp.services.chat_gpt import ChatGPT


class MessageSchema(CamelCaseSchema):
    role = fields.String(
        validate=fields.validate.OneOf(['system', 'user', 'assistant', 'function']),
        required=True,
    )
    content = fields.String(nullable=True, required=True)
    name = fields.String()
    function_call = fields.Dict()


class FunctionSchema(CamelCaseSchema):
    name = fields.String(required=True)
    description = fields.String()
    parameters = fields.Dict(
        keys=fields.String(), values=fields.Raw(), validate=JSONSchema(), required=True
    )


class ChatCompletionsRequestSchema(CamelCaseSchema):
    timeout = fields.Float()
    model = fields.String(
        validate=DeferedOneOf(
            lambda: tuple(
                map(lambda model: model['id'], ChatGPT.ChatCompletion.model_list())
            )
        ),
        required=True,
    )
    messages = fields.List(fields.Nested(MessageSchema()), required=True)
    functions = fields.List(fields.Nested(FunctionSchema()))
    function_call = UnionType(
        types=(
            fields.String(validate=marshmallow.validate.OneOf(('none', 'all'))),
            fields.Dict(
                keys=fields.String(),
                values=fields.String(),
            ),
        ),
    )
    temperature = fields.Float(validate=marshmallow.validate.Range(min=0, max=2))
    top_p = fields.Float()
    n = fields.Integer()
    stream = fields.Boolean()
    stop = fields.List(
        fields.String(required=True), validate=marshmallow.validate.Length(min=0, max=4)
    )
    max_tokens = fields.Integer()
    presence_penalty = fields.Float(validate=marshmallow.validate.Range(min=-2, max=2))
    frequency_penalty = fields.Float(validate=marshmallow.validate.Range(min=-2, max=2))
    logit_bias = fields.Dict(
        keys=fields.String(),
        values=fields.Float(validate=marshmallow.validate.Range(min=-100, max=100)),
    )
    user = fields.String()
