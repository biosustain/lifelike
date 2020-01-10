import os

class Base():
    SITE_NAME = 'neo4j example application'
    SECRET_KEY = os.environ.get('SECRET_KEY', 'secrets')


class Development(Base):
    """Development configurations"""

    ASSETS_DEBUG = True
    WTF_CSRF_ENABLED = False
