import logging
import os
import traceback
import sentry_sdk
from functools import partial

from pythonjsonlogger import jsonlogger
from flask import (
    current_app,
    Flask,
    jsonify,
    has_request_context,
    request,
)

from flask_caching import Cache
from flask_cors import CORS
from werkzeug.utils import (
    find_modules,
    import_string,
)
from flask.logging import wsgi_errors_stream

from neo4japp.database import db, ma, migrate, close_lmdb
from neo4japp.encoders import CustomJSONEncoder
from neo4japp.exceptions import (
    AnnotationError,
    BaseException,
    JWTAuthTokenException,
    JWTTokenException,
    RecordNotFoundException,
    DataNotAvailableException
)

from werkzeug.exceptions import UnprocessableEntity
from sentry_sdk.integrations.flask import FlaskIntegration
from sentry_sdk.integrations.logging import LoggingIntegration
from sentry_sdk.integrations.logging import ignore_logger
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

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
GITHUB_HASH = os.environ.get('GITHUB_HASH', 'unspecified')

# Used for registering blueprints
BLUEPRINT_PACKAGE = __package__ + '.blueprints'
BLUEPRINT_OBJNAME = 'bp'

cors = CORS()

cache = Cache()


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

    if config == 'config.Staging' or config == 'config.Production':

        sentry_logging = LoggingIntegration(
            level=logging.ERROR,
            event_level=logging.ERROR,
        )
        sentry_sdk.init(
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

    app.register_error_handler(AnnotationError, partial(handle_error, 400))
    app.register_error_handler(RecordNotFoundException, partial(handle_error, 404))
    app.register_error_handler(JWTAuthTokenException, partial(handle_error, 401))
    app.register_error_handler(JWTTokenException, partial(handle_error, 401))
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
    reterr = {'apiHttpError': ex.to_dict()}
    current_app.logger.error(f'Request caused {type(ex)} error', exc_info=ex)
    reterr['version'] = GITHUB_HASH
    if current_app.debug:
        reterr['detail'] = "".join(traceback.format_exception(
            etype=type(ex), value=ex, tb=ex.__traceback__))
    return jsonify(reterr), code


def handle_generic_error(code: int, ex: Exception):
    reterr = {'apiHttpError': str(ex)}
    current_app.logger.error('Request caused unhandled exception', exc_info=ex)
    reterr['version'] = GITHUB_HASH
    if current_app.debug:
        reterr['detail'] = "".join(traceback.format_exception(
            etype=type(ex), value=ex, tb=ex.__traceback__))
    return jsonify(reterr), code


# Ensure that response includes all error messages produced from the parser
def handle_webargs_error(code, error):
    reterr = {'apiHttpError': error.data['messages']}
    current_app.logger.error('Request caused UnprocessableEntity error', exc_info=error)
    reterr['version'] = GITHUB_HASH
    if current_app.debug:
        reterr['detail'] = "".join(traceback.format_exception(
            etype=type(error), value=error, tb=error.__traceback__))
    return jsonify(reterr), code
