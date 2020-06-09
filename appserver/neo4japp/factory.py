import logging
import os
import traceback
from functools import partial

from flask import current_app, Flask, jsonify
from flask_caching import Cache
from flask_cors import CORS
from werkzeug.utils import find_modules, import_string

from neo4japp.database import db, ma, migrate
from neo4japp.encoders import CustomJSONEncoder
from neo4japp.exceptions import (
    BaseException, JWTAuthTokenException,
    JWTTokenException, RecordNotFoundException,
    DataNotAvailableException)

import sentry_sdk
from sentry_sdk.integrations.flask import FlaskIntegration
from sentry_sdk.integrations.logging import LoggingIntegration
from sentry_sdk.integrations.logging import ignore_logger
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration


logger = logging.getLogger(__name__)

# Commit Hash (Version) of Application
GITHUB_HASH = os.environ.get('GITHUB_HASH', 'unspecified')

# Used for registering blueprints
BLUEPRINT_PACKAGE = __package__ + '.blueprints'
BLUEPRINT_OBJNAME = 'bp'

cors = CORS()

cache = Cache()


def create_app(name='neo4japp', config='config.Development'):

    if config == 'config.Staging' or config == 'config.Production':
        sentry_logging = LoggingIntegration(
            level=logging.INFO,
            event_level=logging.INFO,
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

    app = Flask(name)
    app.config.from_object(config)

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
    logger.error('Request caused BaseException error', exc_info=ex)
    reterr['version'] = GITHUB_HASH
    if current_app.debug:
        reterr['detail'] = "".join(traceback.format_exception(
            etype=type(ex), value=ex, tb=ex.__traceback__))
    return jsonify(reterr), code


def handle_generic_error(code: int, ex: Exception):
    reterr = {'apiHttpError': str(ex)}
    logger.error('Request caused unhandled exception', exc_info=ex)
    reterr['version'] = GITHUB_HASH
    if current_app.debug:
        reterr['detail'] = "".join(traceback.format_exception(
            etype=type(ex), value=ex, tb=ex.__traceback__))
    return jsonify(reterr), code
