from marshmallow import fields

from .completions_base import CompletionsBaseRequestSchema


class CompletionsRequestSchema(CompletionsBaseRequestSchema):
    model = fields.String(required=True)
    prompt = fields.String(required=True)
    suffix = fields.String()
    echo = fields.Boolean()
    best_of = fields.Integer()
