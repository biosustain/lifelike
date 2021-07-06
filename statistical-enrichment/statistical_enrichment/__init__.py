import logging
import os

from flask import Flask
from flask_marshmallow import Marshmallow

app_name = os.environ.get('FLASK_APP', __name__)
app = Flask(app_name)
Marshmallow().init_app(app)



from .views import *
from .schemas import *
