from typing import Callable, Iterable, Union

import marshmallow
from marshmallow import fields
from marshmallow.validate import Validator

from neo4japp.schemas.base import CamelCaseSchema
from neo4japp.services.chat_gpt import ChatGPT


# noinspection PyMissingConstructor
class DeferedOneOf(marshmallow.validate.OneOf):
    choices_callback: Callable[[], Iterable]

    def __init__(
        self,
        choices_callback: Callable[[], Iterable],
        labels: Union[Iterable[str], None] = None,
        *,
        error: Union[str, None] = None,
    ):
        self.choices_callback = choices_callback
        self.labels = labels if labels is not None else []
        self.labels_text = ", ".join(str(label) for label in self.labels)
        self.error = error or self.default_message  # type: str

    @property
    def choices(self):
        return self.choices_callback()

    @property
    def choices_text(self):
        """Choices is dynamic list so does choices_text need to be"""
        return ", ".join(str(choice) for choice in self.choices)


class CompletionsRequestSchema(CamelCaseSchema):
    timeout = fields.Float()
    model = fields.String(
        validate=DeferedOneOf(
            lambda: tuple(map(lambda model: model['id'], ChatGPT.Model.list()['data']))
        ),
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
        fields.String(required=True), validate=marshmallow.validate.Length(min=0, max=4)
    )
    presence_penalty = fields.Float(validate=marshmallow.validate.Range(min=-2, max=2))
    frequency_penalty = fields.Float(validate=marshmallow.validate.Range(min=-2, max=2))
    best_of = fields.Integer()
    logit_bias = fields.Dict(
        keys=fields.String(),
        values=fields.Float(validate=marshmallow.validate.Range(min=-100, max=100)),
    )

class ChatCompletionsRequestSchema(CamelCaseSchema):
    timeout = fields.Float()
    model = fields.String(
        validate=DeferedOneOf(
            lambda: tuple(map(lambda model: model['id'], ChatGPT.Model.list()['data']))
        ),
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
        fields.String(required=True), validate=marshmallow.validate.Length(min=0, max=4)
    )
    presence_penalty = fields.Float(validate=marshmallow.validate.Range(min=-2, max=2))
    frequency_penalty = fields.Float(validate=marshmallow.validate.Range(min=-2, max=2))
    best_of = fields.Integer()
    logit_bias = fields.Dict(
        keys=fields.String(),
        values=fields.Float(validate=marshmallow.validate.Range(min=-100, max=100)),
    )
