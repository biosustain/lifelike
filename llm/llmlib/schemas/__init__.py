from marshmallow import Schema
from marshmallow.fields import Str, Nested
from marshmallow.validate import OneOf

from .error import OpenAiErrorResponseSchema
from .openai.chat_completions import ChatCompletionsRequestSchema
from .openai.completions import CompletionsRequestSchema


class ServerRequestSchema(Schema):
    user_id = Str(required=True)
    transaction_id = Str(required=True)


class DBRequestSchema(Schema):
    database_type = Str(validate=OneOf(['arango', 'neo4j']), default='arango')
    database_name = Str()


class GraphRequestSchema(Schema):
    graph = Nested(DBRequestSchema())


class GraphCompletionsRequestSchema(CompletionsRequestSchema, GraphRequestSchema):
    pass


class GraphChatCompletionsRequestSchema(
    ChatCompletionsRequestSchema, GraphRequestSchema
):
    pass


__all__ = [
    'OpenAiErrorResponseSchema',
    'GraphCompletionsRequestSchema',
    'GraphChatCompletionsRequestSchema',
]
