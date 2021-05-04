import logging
import os

from .factory import create_app

app_config = os.environ['FLASK_APP_CONFIG']
app = create_app(config=f'config.{app_config}')
logger = logging.getLogger(__name__)

from .views import *
from .schemas import *
