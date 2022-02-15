from flask import Flask
from flask_marshmallow import Marshmallow
import os

from .config import Base

def create_app():
    app_name = os.environ.get('FLASK_APP', __name__)
    app = Flask(app_name)
    app.config.from_object(Base)
    Marshmallow().init_app(app)

    # Initialize Elastic APM if configured
    if os.getenv('ELASTIC_APM_SERVER_URL'):
        from elasticapm.contrib.flask import ElasticAPM
        apm = ElasticAPM(
            app,
            service_name='lifelike-statistical-enrichment',
            environment=os.getenv('FLASK_APP_CONFIG'))

    return app
