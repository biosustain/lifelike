import os


class Base():
    """Default values"""
    SITE_NAME = 'Lifelike Knowledge Search'

    # Optional for tracking the master branch for the build
    GITHUB_HASH = os.getenv('GITHUB_HASH', '__VERSION__')
    GITHUB_LAST_COMMIT_TIMESTAMP = os.getenv('GITHUB_COMMIT_TIMESTAMP', 'undefined')
    APP_BUILD_NUMBER = os.getenv('APP_BUILD_NUMBER', 'undefined')
    APP_VERSION = os.getenv('APP_VERSION', 'undefined')

    JWKS_URL = os.getenv('JWKS_URL', None)
    JWT_SECRET = os.getenv('JWT_SECRET', 'secrets')
    JWT_AUDIENCE = os.getenv('JWT_AUDIENCE', 'account')
    JWT_ALGORITHM = os.getenv('JWT_ALGORITHM', 'HS256')

    POSTGRES_HOST = os.getenv('POSTGRES_HOST')
    POSTGRES_PORT = os.getenv('POSTGRES_PORT')
    POSTGRES_USER = os.getenv('POSTGRES_USER')
    POSTGRES_PASSWORD = os.getenv('POSTGRES_PASSWORD')
    POSTGRES_DB = os.getenv('POSTGRES_DB')

    NEO4J_HOST = os.getenv('NEO4J_HOST')
    NEO4J_SCHEME = os.getenv('NEO4J_SCHEME')
    NEO4J_AUTH = os.getenv('NEO4J_AUTH')
    NEO4J_PORT = os.getenv('NEO4J_PORT')
    NEO4J_DATABASE = os.getenv('NEO4J_DATABASE')

    AZURE_ACCOUNT_STORAGE_NAME = os.getenv('AZURE_ACCOUNT_STORAGE_NAME')
    AZURE_ACCOUNT_STORAGE_KEY = os.getenv('AZURE_ACCOUNT_STORAGE_KEY')
    AZURE_BLOB_STORAGE_URL = os.getenv('AZURE_BLOB_STORAGE_URL')

    ARANGO_HOST = os.getenv('ARANGO_HOST', 'http://localhost:8529')
    ARANGO_USERNAME = os.getenv('ARANGO_USERNAME', '***ARANGO_USERNAME***')
    ARANGO_PASSWORD = os.getenv('ARANGO_PASSWORD', 'password')
    ARANGO_DB_NAME = os.getenv('ARANGO_DB_NAME', '***ARANGO_DB_NAME***')

    SQLALCHEMY_DATABASE_URI = 'postgresql://%s:%s@%s:%s/%s' % (
        POSTGRES_USER,
        POSTGRES_PASSWORD,
        POSTGRES_HOST,
        POSTGRES_PORT,
        POSTGRES_DB
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {'pool_pre_ping': True}

    # Uncomment to run jobs synchronously in-process (default is True)
    # ReF: https://flask-rq2.readthedocs.io/en/latest/#rq-async
    # RQ_ASYNC = False

    SUPPORTED_LOCALES = ['en']


class Development(Base):
    """Development configurations"""

    ASSETS_DEBUG = True
    WTF_CSRF_ENABLED = False
    DOMAIN = 'http://localhost'


class QA(Base):
    """ QA configuration """
    SITE_NAME = 'Lifelike Knowledge Search (QA)'
    DOMAIN = 'https://qa.***ARANGO_DB_NAME***.bio'


class Staging(Base):
    """Staging configurations"""
    SITE_NAME = 'Lifelike Knowledge Search (Staging)'
    DOMAIN = 'https://test.***ARANGO_DB_NAME***.bio'


class Testing(Base):
    """Functional test configuration"""
    TESTING = True
    WTF_CSRF_ENABLED = False
    RQ_CONNECTION_CLASS = 'fakeredis.FakeStrictRedis'
    ARANGO_HOST = os.getenv('ARANGO_HOST', 'http://localhost:8529')
    ARANGO_DB_NAME = 'test_arango'


class Production(Base):
    """ Production configuration """
    DOMAIN = 'https://kg.***ARANGO_DB_NAME***.bio'
