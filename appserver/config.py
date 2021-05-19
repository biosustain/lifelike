import os


class Base():
    """Default values"""
    SITE_NAME = 'Lifelike Knowledge Search'

    # Optional for tracking the master branch for the build
    GITHUB_HASH = os.environ.get('GITHUB_HASH', 'undefined')
    GITHUB_LAST_COMMIT_TIMESTAMP = os.environ.get('GITHUB_COMMIT_TIMESTAMP', 'undefined')
    APP_BUILD_NUMBER = os.environ.get('APP_BUILD_NUMBER', 'undefined')
    APP_VERSION = os.environ.get('APP_VERSION', 'undefined')

    SECRET_KEY = os.environ.get('SECRET_KEY', 'secrets')

    POSTGRES_HOST = os.environ.get('POSTGRES_HOST')
    POSTGRES_PORT = os.environ.get('POSTGRES_PORT')
    POSTGRES_USER = os.environ.get('POSTGRES_USER')
    POSTGRES_PASSWORD = os.environ.get('POSTGRES_PASSWORD')
    POSTGRES_DB = os.environ.get('POSTGRES_DB')

    NEO4J_HOST = os.environ.get('NEO4J_HOST')
    NEO4J_SCHEME = os.environ.get('NEO4J_SCHEME')
    NEO4J_AUTH = os.environ.get('NEO4J_AUTH')
    NEO4J_PORT = os.environ.get('NEO4J_PORT')
    NEO4J_DATABASE = os.environ.get('NEO4J_DATABASE')

    AZURE_ACCOUNT_STORAGE_NAME = os.environ.get('AZURE_ACCOUNT_STORAGE_NAME')
    AZURE_ACCOUNT_STORAGE_KEY = os.environ.get('AZURE_ACCOUNT_STORAGE_KEY')
    AZURE_BLOB_STORAGE_URL = os.environ.get('AZURE_BLOB_STORAGE_URL')

    SQLALCHEMY_DATABASE_URI = 'postgresql://%s:%s@%s:%s/%s' % (
        POSTGRES_USER,
        POSTGRES_PASSWORD,
        POSTGRES_HOST,
        POSTGRES_PORT,
        POSTGRES_DB
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {'pool_pre_ping': True}

    SUPPORTED_LOCALES = ['en']


class Development(Base):
    """Development configurations"""

    ASSETS_DEBUG = True
    WTF_CSRF_ENABLED = False
    DOMAIN = 'http://localhost'


class QA(Base):
    """ QA configuration """
    SITE_NAME = 'Lifelike Knowledge Search (QA)'
    DOMAIN = 'https://qa.lifelike.bio'


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
