import logging
from functools import partial
from datetime import datetime

from flask import current_app, Flask, jsonify
from flask_caching import Cache
from flask_cors import CORS
from werkzeug.utils import find_modules, import_string

from neo4japp.encoders import CustomJSONEncoder
from neo4japp.database import db, ma, migrate
from neo4japp.exceptions import (
    BaseException, JWTAuthTokenException,
    JWTTokenException, RecordNotFoundException,
    BadRequestError)


logger = logging.getLogger(__name__)

# Used for registering blueprints
BLUEPRINT_PACKAGE = __package__ + '.blueprints'
BLUEPRINT_OBJNAME = 'bp'

cors = CORS()

cache = Cache()


def create_app(name='neo4japp', config='config.Development'):
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

    app.config['BUILD_TIMESTAMP'] = datetime.now()
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
    app.register_error_handler(BadRequestError, partial(handle_bad_request_exception, 400))
    app.register_error_handler(Exception, partial(handle_generic_error, 500))
    return app


def register_blueprints(app, pkgname):
    for name in find_modules(pkgname):
        mod = import_string(name)
        if hasattr(mod, BLUEPRINT_OBJNAME):
            app.register_blueprint(mod.bp)


def handle_error(code: int, ex: BaseException):
    reterr = {'apiHttpError': ex.to_dict()}
    if current_app.debug:
        logger.error("Request caused BaseException error", exc_info=ex)
    return jsonify(reterr), code


def handle_bad_request_exception(code: int, ex: BadRequestError):
    reterr = {'message': ex.message}
    if current_app.debug:
        logger.warning("Request caused BadRequestError", exc_info=ex)
    return jsonify(reterr), code


def handle_generic_error(code: int, ex: Exception):
    reterr = {'apiHttpError': str(ex)}
    if current_app.debug:
        logger.error("Request caused unhandled exception", exc_info=ex)
    return jsonify(reterr), code
