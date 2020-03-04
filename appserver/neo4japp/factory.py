from functools import partial

from flask import current_app, Flask, jsonify
from flask_caching import Cache
from flask_httpauth import HTTPTokenAuth
from werkzeug.utils import find_modules, import_string

from neo4japp.database import db, ma
from neo4japp.exceptions import BaseException

# Used for registering blueprints
BLUEPRINT_PACKAGE = __package__ + '.blueprints'
BLUEPRINT_OBJNAME = 'bp'

cache = Cache()


def create_app(name = 'neo4japp', config = 'config.Development'):
    app = Flask(name)
    app.config.from_object(config)

    db.init_app(app)
    ma.init_app(app)

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

    app.register_error_handler(BaseException, partial(handle_error, 500))
    # TODO: handle uncaught python errors
    return app


def register_blueprints(app, pkgname):
    for name in find_modules(pkgname):
        mod = import_string(name)
        if hasattr(mod, BLUEPRINT_OBJNAME):
            app.register_blueprint(mod.bp)


def handle_error(code: int, ex: BaseException):
    reterr = {'apiHttpError': ex.to_dict()}
    return jsonify(reterr), code
