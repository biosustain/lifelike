import logging
import os
import sentry_sdk
import traceback

from functools import partial

from flask import (
    current_app,
    Flask,
    jsonify,
    has_request_context,
    request,
    g,
)
from flask.logging import wsgi_errors_stream
from flask_caching import Cache
from marshmallow import ValidationError
from pythonjsonlogger import jsonlogger
from sentry_sdk.integrations.flask import FlaskIntegration
from sentry_sdk.integrations.logging import LoggingIntegration
from sentry_sdk.integrations.logging import ignore_logger
from werkzeug.exceptions import UnprocessableEntity

from .constants import LogEventType
from .database import ma, close_neo4j_db
from .encoders import CustomJSONEncoder
from .exceptions import ServerException
from .schemas.common import ErrorResponseSchema
from .utils.logger import ErrorLog

# Set the following modules to have a minimum of log level 'WARNING'
module_logs = [
    'webargs',
    'py2neo'
]

for mod in module_logs:
    logging.getLogger(mod).setLevel(logging.WARNING)

# Commit Hash (Version) of Application
GITHUB_HASH = os.environ.get('GITHUB_HASH', 'undefined')

cache = Cache()

def filter_to_sentry(event, hint):
    """ filter_to_sentry is used for filtering what
    to return or manipulating the exception before sending
    it off to Sentry (sentry.io)
    The 'extra' keyword is part of the LogRecord
    object's dictionary and is where the flag
    for sending to Sentry is set.
    Example use case:
    current_app.logger.error(
        err_formatted, exc_info=ex, extra={'to_sentry': True})
    """
    # By default, we send to sentry
    to_sentry = event['extra'].get('to_sentry', True)
    if to_sentry:
        return event
    return None


class CustomJsonFormatter(jsonlogger.JsonFormatter):
    """ Adds meta data about the request when available """

    def add_fields(self, log_record, record, message_dict):
        super(CustomJsonFormatter, self).add_fields(log_record, record, message_dict)
        if has_request_context():
            log_record['request_url'] = request.url
            log_record['request_ip_addr'] = request.remote_addr


def create_app(name='', config='config.Development'):
    app_logger = logging.getLogger(name)
    log_handler = logging.StreamHandler(stream=wsgi_errors_stream)
    format_str = '%(message)%(levelname)%(asctime)%(module)'
    formatter = CustomJsonFormatter(format_str)
    log_handler.setFormatter(formatter)
    app_logger.addHandler(log_handler)

    if config in ['config.Staging', 'config.Production']:
        sentry_logging = LoggingIntegration(
            level=logging.ERROR,
            event_level=logging.ERROR,
        )
        sentry_sdk.init(
            before_send=filter_to_sentry,
            dsn=os.environ.get('SENTRY_KEY'),
            integrations=[
                sentry_logging,
                FlaskIntegration()
            ],
            send_default_pii=True,
        )
        ignore_logger('werkzeug')
        app_logger.setLevel(logging.INFO)
    else:
        # Set to 'true' for dev mode to have
        # the same format as staging.
        if os.environ.get('FORMAT_AS_JSON', 'false') == 'false':
            app_logger.removeHandler(log_handler)
        app_logger.setLevel(logging.DEBUG)

    app = Flask(name)
    # app.config.from_object(config)
    app.teardown_appcontext_funcs = [close_neo4j_db]

    ma.init_app(app)

    cache_config = {
        'CACHE_TYPE': 'simple',
        'CACHE_THRESHOLD': 10,
    }

    app.config.from_object(cache_config)

    # init cache
    # TODO: temp solution to a cache
    # (uses SimpleCache: https://flask-caching.readthedocs.io/en/latest/#simplecache)
    cache.init_app(app, config=cache_config)

    app.json_encoder = CustomJSONEncoder

    app.register_error_handler(ValidationError, partial(handle_validation_error, 400))
    app.register_error_handler(UnprocessableEntity, partial(handle_webargs_error, 400))
    app.register_error_handler(ServerException, handle_error)
    app.register_error_handler(Exception, partial(handle_generic_error, 500))
    return app


def handle_error(ex: ServerException):
    current_user = g.current_user.username if g.get('current_user') else 'anonymous'
    transaction_id = request.headers.get('X-Transaction-Id', '')
    current_app.logger.error(
        f'Request caused a handled exception <{type(ex)}>',
        exc_info=ex,
        extra={
            **{'to_sentry': False},
            **ErrorLog(
                error_name=f'{type(ex)}',
                expected=True,
                event_type=LogEventType.SENTRY_HANDLED.value,
                transaction_id=transaction_id,
                username=current_user,
            ).to_dict()
        }
    )

    ex.version = GITHUB_HASH
    ex.transaction_id = transaction_id
    if current_app.debug:
        ex.stacktrace = ''.join(traceback.format_exception(
            etype=type(ex), value=ex, tb=ex.__traceback__))

    return jsonify(ErrorResponseSchema().dump(ex)), ex.code


def handle_generic_error(code: int, ex: Exception):
    # create a default server error
    # display to user the default error message
    # but log with the real exception message below
    newex = ServerException()
    current_user = g.current_user.username if g.get('current_user') else 'anonymous'
    transaction_id = request.headers.get('X-Transaction-Id', '')
    current_app.logger.error(
        f'Request caused a unhandled exception <{type(ex)}>',
        exc_info=ex,
        extra={
            **{'to_sentry': False},
            **ErrorLog(
                error_name=f'{type(ex)}',
                expected=True,
                event_type=LogEventType.SENTRY_UNHANDLED.value,
                transaction_id=transaction_id,
                username=current_user,
            ).to_dict()
        }
    )

    newex.version = GITHUB_HASH
    newex.transaction_id = transaction_id
    if current_app.debug:
        newex.stacktrace = ''.join(traceback.format_exception(
            etype=type(ex), value=ex, tb=ex.__traceback__))

    return jsonify(ErrorResponseSchema().dump(newex)), newex.code


def handle_validation_error(code, error: ValidationError, messages=None):
    """
    Handle errors that are related to form or input validation (any arguments provided by
    the user).
    The goal here is to preserve the errors generated on the server, which will often be
    through Marshmallow, and send them to the client so the client can tie the errors
    to the associated form fields.
    As of writing, we don't fully tackle the problem because we do camel case conversion
    on the field names and that doesn't happen here, but we cannot just blindly camelCase the field
    names because not all our API payloads use camel case.
    """
    current_app.logger.error('Request caused UnprocessableEntity error', exc_info=error)

    fields: dict = messages or error.normalized_messages()
    field_keys = list(fields.keys())

    # Generate a message (errors need a message that can be shown to the user)
    if len(field_keys) == 1:
        key = field_keys[0]
        field = fields[key]
        message = '; '.join(field)
    else:
        message = 'An error occurred with the provided input.'

    ex = ServerException(message=message, code=code, fields=fields)
    current_user = g.current_user.username if g.get('current_user') else 'anonymous'
    transaction_id = request.headers.get('X-Transaction-Id', '')

    ex.version = GITHUB_HASH
    ex.transaction_id = transaction_id
    return jsonify(ErrorResponseSchema().dump(ex)), ex.code


# Ensure that response includes all error messages produced from the parser
def handle_webargs_error(code, error):
    return handle_validation_error(code, error, error.data['messages'])
