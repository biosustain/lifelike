import json
import logging
import os
import traceback
from functools import partial
from typing import Optional, Union, Literal, List, Dict

import sentry_sdk
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
from marshmallow.exceptions import SCHEMA
from pythonjsonlogger import jsonlogger
from sentry_sdk.integrations.flask import FlaskIntegration
from sentry_sdk.integrations.logging import LoggingIntegration
from sentry_sdk.integrations.logging import ignore_logger
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from webargs.flaskparser import parser
from werkzeug.exceptions import UnprocessableEntity
from werkzeug.utils import (
    find_modules,
    import_string,
)

from neo4japp.database import db, ma, migrate, close_lmdb
from neo4japp.encoders import CustomJSONEncoder
from neo4japp.exceptions import (
    BaseException,
    JWTAuthTokenException,
    JWTTokenException,
    RecordNotFoundException,
    DataNotAvailableException, AccessRequestRequiredError, FilesystemAccessRequestRequired
)
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


class ErrorResponse:
    """
    Encapsulates the error object that is sent to the client. The purpose of this class
    is to keep errors sent to the client consistent, but as of writing, this class is
    a mix of older error handling code and newer error handling code.
    """

    def __init__(self,
                 code: Optional[Union[Literal['validation'], Literal['permission']]],
                 message: str,
                 *,
                 detail: Optional[str] = None,
                 api_http_error: str = None,
                 version: str = None,
                 transaction_id: str = None,
                 fields: Optional[Dict[str, List[str]]] = None,
                 debug_exception: Exception = None):
        """
        Create a new instance of the error.

        :param code: the error code is a machine-parseable error code (not used yet)
        :param message: a message that can be displayed direct to the user
        :param detail: extra text that is show on the client in a 'extra info' box
        :param api_http_error: the old way of returning the error
        :param version: the version of the app
        :param transaction_id: a transaction ID that goes into our logs
        :param fields: a dictionary of form fields (or _schema for generic) and its errors
        :param debug_exception: an exception that can be dumped into the 'detail' field
        """
        assert debug_exception is None or detail is None

        self.message = message
        self.detail = detail if detail else None
        self.code = code
        self.api_http_error = api_http_error
        self.version = version or GITHUB_HASH
        self.transaction_id = transaction_id or request.headers.get('X-Transaction-Id', '')
        self.fields = fields or {}

        if current_app.debug and debug_exception:
            self.detail = "".join(traceback.format_exception(
                etype=type(debug_exception), value=debug_exception,
                tb=debug_exception.__traceback__))


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

    if config in ['config.QA', 'config.Staging', 'config.Production']:

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

    app.register_error_handler(RecordNotFoundException, partial(handle_error, 404))
    app.register_error_handler(JWTAuthTokenException, partial(handle_error, 401))
    app.register_error_handler(JWTTokenException, partial(handle_error, 401))
    app.register_error_handler(FilesystemAccessRequestRequired, partial(handle_access_error, 403))
    app.register_error_handler(AccessRequestRequiredError, partial(handle_access_error, 403))
    app.register_error_handler(ValidationError, partial(handle_validation_error, 400))
    app.register_error_handler(UnprocessableEntity, partial(handle_webargs_error, 400))
    app.register_error_handler(BaseException, partial(handle_error, 400))
    app.register_error_handler(Exception, partial(handle_generic_error, 500))
    app.register_error_handler(DataNotAvailableException, partial(handle_error, 500))
    return app


def register_blueprints(app, pkgname):
    for name in find_modules(pkgname):
        mod = import_string(name)
        if hasattr(mod, BLUEPRINT_OBJNAME):
            app.register_blueprint(mod.bp)


def handle_error(code: int, ex: BaseException):
    current_user = g.current_user.username if g.get('current_user') else 'anonymous'
    reterr = {'apiHttpError': ex.to_dict()}
    reterr['version'] = GITHUB_HASH
    transaction_id = request.headers.get('X-Transaction-Id', '')
    reterr['transactionId'] = transaction_id
    current_app.logger.error(
        f'Request caused a handled exception "{type(ex)}"',
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
    if current_app.debug:
        reterr['detail'] = "".join(traceback.format_exception(
            etype=type(ex), value=ex, tb=ex.__traceback__))

    return jsonify(reterr), code


def handle_generic_error(code: int, ex: Exception):
    current_user = g.current_user.username if g.get('current_user') else 'anonymous'
    reterr = {'apiHttpError': str(ex)}
    transaction_id = request.headers.get('X-Transaction-Id', '')
    reterr['transactionId'] = transaction_id
    current_app.logger.error(
        'Request caused unhandled exception',
        exc_info=ex,
        extra=ErrorLog(
            error_name=f'{type(ex)}',
            expected=False,
            event_type='unhandled exception',
            transaction_id=transaction_id,
            username=current_user,
        ).to_dict()
    )
    reterr['version'] = GITHUB_HASH

    if current_app.debug:
        reterr['detail'] = "".join(traceback.format_exception(
            etype=type(ex), value=ex, tb=ex.__traceback__))
    return jsonify(reterr), code


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

    return jsonify(ErrorResponseSchema().dump(ErrorResponse(
        'validation',
        message,
        fields=fields,
        api_http_error='An error occurred with the provided input.',
    ))), code


def handle_access_error(code,
                        error: Union[AccessRequestRequiredError, FilesystemAccessRequestRequired],
                        messages=None):
    """
    Handle errors that occurs when a user doesn't have permission to something but can
    request permission. This handler is not really fleshed out yet.
    """
    current_app.logger.error('Request caused access error', exc_info=error)
    return jsonify(ErrorResponseSchema().dump(ErrorResponse(
        'permission',
        error.message,
        api_http_error='You do not have the correct permissions for this item.',
        debug_exception=error,
    ))), code


# Ensure that response includes all error messages produced from the parser
def handle_webargs_error(code, error):
    return handle_validation_error(code, error, error.data['messages'])
