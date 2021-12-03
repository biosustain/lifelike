import os

from flask import Flask
from flask_marshmallow import Marshmallow

app_name = os.environ.get('FLASK_APP', __name__)
app = Flask(app_name)
Marshmallow().init_app(app)

# Initialize Elastic APM if configured
if os.getenv('ELASTIC_APM_SERVER_URL'):
    from elasticapm.contrib.flask import ElasticAPM
    apm = ElasticAPM(
        app,
        service_name='***ARANGO_DB_NAME***-statistical-enrichment',
        environment=os.getenv('FLASK_ENV'))

from .views import *
from .schemas import *
