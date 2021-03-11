import json
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
from flask_cors import CORS
from marshmallow import ValidationError, missing
from pythonjsonlogger import jsonlogger
from sentry_sdk.integrations.flask import FlaskIntegration
from sentry_sdk.integrations.logging import LoggingIntegration
from sentry_sdk.integrations.logging import ignore_logger
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from webargs.flaskparser import parser
from werkzeug.exceptions import UnprocessableEntity
from werkzeug.utils import find_modules, import_string

from neo4japp.database import db, ma, migrate, close_lmdb
from neo4japp.encoders import CustomJSONEncoder
from neo4japp.exceptions import ServerException
from neo4japp.schemas.common import ErrorResponseSchema
from neo4japp.utils.logger import ErrorLog

# Set the following modules to have a minimum of log level 'WARNING'
module_logs = [
    'pdfminer',
    'graphviz',
    'flask_caching',
    'urllib3',
    'alembic',
    'webargs',
]

for mod in module_logs:
    logging.getLogger(mod).setLevel(logging.WARNING)

# Commit Hash (Version) of Application
GITHUB_HASH = os.environ.get('GITHUB_HASH', 'undefined')

# Used for registering blueprints
BLUEPRINT_PACKAGE = __package__ + '.blueprints'
BLUEPRINT_OBJNAME = 'bp'

cors = CORS()
cache = Cache()


@parser.location_handler("mixed_form_json")
def load_mixed_form_json(request, name, field):
    """
    Handle JSON that needs to be mixed with file uploads.

    The problem this is trying to fix is that there is no way to send both JSON data and file
    uploads in the same request. The proper way of achieving this would probably be to use
    multipart/mixed, but support for that is too weak in our web server and in Angular, so
    this is a hacky way of achieving this dream. There is an associated function on the client
    that formats form data to be compatible here.
    """

    # Memoize the JSON parsing - we don't have to do this in newer versions
    # of webargs but we are stuck on this old version because of flask-apispec
    cache_field = '_mixed_form_json_cache'

    if hasattr(request, cache_field):
        getter = getattr(request, cache_field)
    else:
        try:
            data = json.loads(request.form['json$'])

            def getter():
                return data
        except (KeyError, ValueError) as e:
            exception = e

            def getter():
                raise exception

        setattr(request, cache_field, getter)

    try:
        return getter()[name]
    except KeyError:
        return missing


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


def create_app(name='neo4japp', config='config.Development'):
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
                FlaskIntegration(),
                SqlalchemyIntegration(),
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
    app.config.from_object(config)
    app.teardown_appcontext_funcs = [close_lmdb]

    cors.init_app(app)
    db.init_app(app)
    ma.init_app(app)
    migrate.init_app(app, db)

    register_blueprints(app, BLUEPRINT_PACKAGE)

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


def register_blueprints(app, pkgname):
    for name in find_modules(pkgname):
        mod = import_string(name)
        if hasattr(mod, BLUEPRINT_OBJNAME):
            app.register_blueprint(mod.bp)


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
                event_type='handled exception',
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
                event_type='unhandled exception',
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
