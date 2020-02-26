import os

class Base():
    """Default values"""
    SITE_NAME = 'neo4j example application'
    SECRET_KEY = os.environ.get('SECRET_KEY', 'secrets')

    POSTGRES_HOST = os.environ.get('POSTGRES_HOST')
    POSTGRES_PORT = os.environ.get('POSTGRES_PORT')
    POSTGRES_USER = os.environ.get('POSTGRES_USER')
    POSTGRES_PASSWORD = os.environ.get('POSTGRES_PASSWORD')
    POSTGRES_DB = os.environ.get('POSTGRES_DB')

    SQLALCHEMY_DATABASE_URI = 'postgresql://%s:%s@%s:%s/%s' % (
        POSTGRES_USER,
        POSTGRES_PASSWORD,
        POSTGRES_HOST,
        POSTGRES_PORT,
        POSTGRES_DB
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    SUPPORTED_LOCALES = ['en']

class Development(Base):
    """Development configurations"""

    ASSETS_DEBUG = True
    WTF_CSRF_ENABLED = False
