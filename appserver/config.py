import os


class Base():
    """Default values"""
    SITE_NAME = 'Lifelike Knowledge Search'

    # Optional for tracking the master branch for the build
    GITHUB_HASH = os.environ.get('GITHUB_HASH', 'undefined')
    GITHUB_LAST_COMMIT_TIMESTAMP = os.environ.get('GITHUB_COMMIT_TIMESTAMP', 'undefined')

    SECRET_KEY = os.environ.get('SECRET_KEY', 'secrets')

    POSTGRES_HOST = os.environ.get('POSTGRES_HOST')
    POSTGRES_PORT = os.environ.get('POSTGRES_PORT')
    POSTGRES_USER = os.environ.get('POSTGRES_USER')
    POSTGRES_PASSWORD = os.environ.get('POSTGRES_PASSWORD')
    POSTGRES_DB = os.environ.get('POSTGRES_DB')

    NEO4J_HOST = os.environ.get('NEO4J_HOST')
    NEO4J_AUTH = os.environ.get('NEO4J_AUTH')

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
    DOMAIN = 'http://localhost'


class Staging(Base):
    """Staging configurations"""
    SITE_NAME = 'Lifelike Knowledge Search (Staging)'
    DOMAIN = 'https://test.lifelike.bio'


class Testing(Base):
    """Functional test configuration"""
    TESTING = True
    WTF_CSRF_ENABLED = False


class Production(Base):
    """ Production configuration """
    DOMAIN = 'https://kg.lifelike.bio'
