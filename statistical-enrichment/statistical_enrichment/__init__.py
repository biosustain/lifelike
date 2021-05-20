import logging
import os

from flask import Flask
from flask_marshmallow import Marshmallow

app_name = os.environ['FLASK_APP']
app = Flask(app_name)
Marshmallow().init_app(app)
logger = logging.getLogger(__name__)

from .views import *
from .schemas import *
