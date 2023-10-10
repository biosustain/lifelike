import json
import logging
from http import HTTPStatus

from elasticapm.contrib.flask import ElasticAPM
from neo4j.exceptions import ServiceUnavailable
from functools import partial
from flask import current_app, Flask, jsonify, has_request_context, request
from flask.logging import wsgi_errors_stream
from flask_caching import Cache
from flask_cors import CORS
from marshmallow import ValidationError, missing
import yaml
from pythonjsonlogger import jsonlogger
from webargs.flaskparser import parser
from werkzeug.exceptions import UnprocessableEntity
from werkzeug.utils import find_modules, import_string

from neo4japp.constants import LogEventType
from neo4japp.database import (
    close_neo4j_db,
    close_redis_conn,
    close_arango_client,
    db,
    ma,
    migrate,
)
from neo4japp.encoders import CustomJSONEncoder
from neo4japp.exceptions import ServerException, ServerWarning
from neo4japp.schemas.common import ErrorResponseSchema, WarningResponseSchema
from neo4japp.services.chat_gpt import ChatGPT
from neo4japp.utils.globals import get_current_username
from neo4japp.utils.logger import ErrorLog, WarningLog
from neo4japp.utils.server_timing import ServerTiming
from neo4japp.utils.transaction_id import transaction_id

apm = ElasticAPM()

# Set the following modules to have a minimum of log level 'WARNING'
module_logs = [
    'pdfminer',
    'graphviz',
    'flask_caching',
    'urllib3',
    'alembic',
    'webargs',
    'werkzeug',
]

for mod in module_logs:
    logging.getLogger(mod).setLevel(logging.WARNING)

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


class CustomJsonFormatter(jsonlogger.JsonFormatter):
    """Adds meta data about the request when available"""

    def add_fields(self, log_record, record, message_dict):
        super(CustomJsonFormatter, self).add_fields(log_record, record, message_dict)
        if has_request_context():
            log_record['request_url'] = request.url
            log_record['request_ip_addr'] = request.remote_addr


def create_app(name='neo4japp', config_package='config.Development'):
    app_logger = logging.getLogger(name)
    log_handler = logging.StreamHandler(stream=wsgi_errors_stream)
    format_str = '%(message)%(levelname)%(asctime)%(module)'
    formatter = CustomJsonFormatter(format_str)
    log_handler.setFormatter(formatter)
    app_logger.addHandler(log_handler)

    app = Flask(name)
    app.config.from_object(config_package)
    app.teardown_appcontext_funcs = [
        close_neo4j_db,
        close_redis_conn,
        close_arango_client,
    ]

    if not app.config.get('FORMAT_AS_JSON'):
        app_logger.removeHandler(log_handler)
    app_logger.setLevel(app.config.get('LOGGING_LEVEL', logging.INFO))

    cors.init_app(app)
    db.init_app(app)
    ma.init_app(app)
    migrate.init_app(app, db)
    ChatGPT.init_app(app)
    ServerTiming.init_app(app)

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

    app.register_error_handler(
        ValidationError, partial(handle_validation_error, HTTPStatus.BAD_REQUEST)
    )
    app.register_error_handler(
        UnprocessableEntity, partial(handle_webargs_error, HTTPStatus.BAD_REQUEST)
    )
    app.register_error_handler(ServerException, handle_error)
    app.register_error_handler(BrokenPipeError, handle_error)
    app.register_error_handler(ServiceUnavailable, handle_error)
    app.register_error_handler(ServerWarning, handle_warning)
    app.register_error_handler(Warning, partial(handle_generic_warning, 199))
    app.register_error_handler(Exception, partial(handle_generic_error, 500))

    # NOTE: Disabling this since we don't seem to be actively using it anymore.
    # Initialize Elastic APM if configured
    # if app.config.get('ELASTIC_APM_SERVER_URL'):
    #     apm.init_app(
    #         app,
    #         service_name='lifelike-appserver',
    #         environment=app.config.get('FLASK_APP_CONFIG')
    #     )

    return app


def register_blueprints(app, pkgname):
    for name in find_modules(pkgname):
        mod = import_string(name)
        if hasattr(mod, BLUEPRINT_OBJNAME):
            app.register_blueprint(mod.bp)


def handle_error(ex):
    current_app.logger.error(
        f'Request caused a handled exception <{type(ex)}>',
        exc_info=ex,
        extra=ErrorLog(
            error_name=f'{type(ex)}',
            expected=True,
            event_type=LogEventType.HANDLED.value,
            transaction_id=transaction_id,
            username=get_current_username(),
        ).to_dict(),
    )
    return jsonify(ErrorResponseSchema().dump(ex)), ex.code


def handle_warning(warn):
    current_app.logger.warning(
        f'Request returned a handled warning <{type(warn)}>',
        exc_info=warn,
        extra=WarningLog(
            warning_name=f'{type(warn)}',
            event_type=LogEventType.WARNINIG.value,
            transaction_id=transaction_id,
            username=get_current_username(),
        ).to_dict(),
    )
    return jsonify(WarningResponseSchema().dump(warn)), warn.code


def handle_generic_error(code: HTTPStatus, ex: Exception):
    # create a default server error
    # display to user the default error message
    # but log with the real exception message below
    current_app.logger.error(
        f'Request caused a unhandled exception <{type(ex)}>',
        exc_info=ex,
        extra=ErrorLog(
            error_name=f'{type(ex)}',
            expected=True,
            event_type=LogEventType.UNHANDLED.value,
            transaction_id=transaction_id,
            username=get_current_username(),
        ).to_dict(),
    )

    try:
        raise ServerException(code=code) from ex
    except ServerException as newex:
        return jsonify(ErrorResponseSchema().dump(newex)), newex.code


def handle_generic_warning(code: int, ex: Warning):
    # create a default server warning
    # display to user the default warning message
    # but log with the real warning message below
    current_app.logger.error(
        f'Request caused a unhandled exception <{type(ex)}>',
        exc_info=ex,
        extra=WarningLog(
            warning_name=f'{type(ex)}',
            event_type=LogEventType.WARNINIG.value,
            transaction_id=transaction_id,
            username=get_current_username(),
        ).to_dict(),
    )

    try:
        raise ServerWarning() from ex
    except ServerException as newex:
        return jsonify(WarningResponseSchema().dump(newex)), newex.code


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

    try:
        raise ServerException(
            message='An error occurred with the provided input.',
            additional_msgs=(yaml.dump(fields),),
            code=code,
            fields=fields,
        ) from error
    except ServerException as newex:
        return jsonify(ErrorResponseSchema().dump(newex)), newex.code


# Ensure that response includes all error messages produced from the parser
def handle_webargs_error(code, error):
    return handle_validation_error(code, error, error.data['messages'])
