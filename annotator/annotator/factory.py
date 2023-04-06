from flask import Flask
from flask_marshmallow import Marshmallow
import os

from .config import Base

def create_app():
    app_name = os.environ.get('FLASK_APP', __name__)
    app = Flask(app_name)
    app.config.from_object(Base)
    Marshmallow().init_app(app)

    return app
