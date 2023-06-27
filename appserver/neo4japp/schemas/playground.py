import marshmallow
from marshmallow import fields

from neo4japp.schemas.base import CamelCaseSchema
from neo4japp.services.chat_gpt import ChatGPT


class ContextPlaygroundRequestSchema(CamelCaseSchema):
    timeout = fields.Float()
    model = fields.String(
        validate=marshmallow.validate.OneOf(ChatGPT.Completion.models),
        required=True,
    )
    prompt = fields.String(required=True)
    max_tokens = fields.Integer()
    temperature = fields.Float(validate=marshmallow.validate.Range(min=0, max=2))
    top_p = fields.Float()
    n = fields.Integer()
    stream = fields.Boolean()
    logprobs = fields.Integer(
        validate=marshmallow.validate.Range(min=0, max=5), allow_none=True
    )
    echo = fields.Boolean()
    stop = fields.List(
        fields.String(required=True),
        validate=marshmallow.validate.Length(min=0, max=4),
        allow_none=True,
    )
    presence_penalty = fields.Float(validate=marshmallow.validate.Range(min=-2, max=2))
    frequency_penalty = fields.Float(validate=marshmallow.validate.Range(min=-2, max=2))
    best_of = fields.Integer()
    logit_bias = fields.Dict(
        keys=fields.String(),
        values=fields.Float(validate=marshmallow.validate.Range(min=-100, max=100)),
    )
