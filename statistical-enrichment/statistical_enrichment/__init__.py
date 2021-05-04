from neo4japp.factory import create_app
import logging
import os

app_config = os.environ['FLASK_APP_CONFIG']
app = create_app(config=f'config.{app_config}')
logger = logging.getLogger(__name__)

import statistical_enrichment.views
import statistical_enrichment.schemas
