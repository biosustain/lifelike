import traceback

from flask import current_app
from marshmallow import fields, Schema

from llmlib.utils import transaction_id


class OpenAiErrorResponseSchema(Schema):
    """All errors are emitted with this schema."""
    title = "OpenAI Server Error"
    type = fields.Function(lambda obj: type(obj).__name__)
    message = fields.Function(lambda obj: obj.user_message)
    code = fields.Function(lambda obj: obj.http_status)
    transaction_id = fields.Function(lambda obj: transaction_id)

    stacktrace = fields.Method('get_stacktrace')

    # noinspection PyMethodMayBeStatic
    def get_stacktrace(self, ex):
        if current_app.config.get('FORWARD_STACKTRACE'):
            return ''.join(
                traceback.format_exception(
                    etype=type(ex), value=ex, tb=ex.__traceback__
                )
            )


__all__ = [
    'OpenAiErrorResponseSchema'
]
