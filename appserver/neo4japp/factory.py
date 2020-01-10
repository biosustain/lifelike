from flask import current_app, Flask
from werkzeug.utils import find_modules, import_string

# Used for registering blueprints
BLUEPRINT_PACKAGE = __package__ + '.blueprints'
BLUEPRINT_OBJNAME = 'bp'


def create_app(name = 'neo4japp', config = 'config.Development'):
    app = Flask(name)
    app.config.from_object(config)
    register_blueprints(app, BLUEPRINT_PACKAGE)
    return app


def register_blueprints(app, pkgname):
    for name in find_modules(pkgname):
        mod = import_string(name)
        if hasattr(mod, BLUEPRINT_OBJNAME):
            app.register_blueprint(mod.bp)

