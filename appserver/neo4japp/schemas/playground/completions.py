import marshmallow
from marshmallow import fields

from neo4japp.schemas.base import CamelCaseSchema
from neo4japp.schemas.playground.completions_base import CompletionsBaseRequestSchema
from neo4japp.schemas.validators import DeferedOneOf
from neo4japp.services.chat_gpt import ChatGPT


class CompletionsRequestSchema(CompletionsBaseRequestSchema):
    model = fields.String(
        validate=DeferedOneOf(
            lambda: tuple(
                map(lambda model: model['id'], ChatGPT.Completion.model_list())
            )
        ),
        required=True,
    )
    prompt = fields.String(required=True)
    suffix = fields.String()
    echo = fields.Boolean()
    best_of = fields.Integer()
