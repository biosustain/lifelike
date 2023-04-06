from flask import Flask
from flask_marshmallow import Marshmallow
from os import environ

class Base():
    """Default values"""
    ARANGO_HOST = environ.get('ARANGO_HOST', 'http://localhost:8529')
    ARANGO_USERNAME = environ.get('ARANGO_USERNAME', '***ARANGO_USERNAME***')
    ARANGO_PASSWORD = environ.get('ARANGO_PASSWORD', 'password')
    ARANGO_DB_NAME = environ.get('ARANGO_DB_NAME', '***ARANGO_DB_NAME***')


def create_app():
    app_name = environ.get('FLASK_APP', __name__)
    app = Flask(app_name)
    app.config.from_object(Base)
    Marshmallow().init_app(app)

    return app

app = create_app()
