import os


class Base():
    """Default values"""
    SITE_NAME = 'Lifelike Knowledge Search'

    # Optional for tracking the master branch for the build
    GITHUB_HASH = os.environ.get('GITHUB_HASH', '__VERSION__')
    GITHUB_LAST_COMMIT_TIMESTAMP = os.environ.get('GITHUB_COMMIT_TIMESTAMP', 'undefined')
    APP_BUILD_NUMBER = os.environ.get('APP_BUILD_NUMBER', 'undefined')
    APP_VERSION = os.environ.get('APP_VERSION', 'undefined')

    JWKS_URL = os.environ.get('JWKS_URL', None)
    JWT_SECRET = os.environ.get('JWT_SECRET', 'secrets')
    JWT_AUDIENCE = os.environ.get('JWT_AUDIENCE', None)
    JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')

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

    ARANGO_HOST = os.getenv('ARANGO_HOST', 'http://localhost:8529')
    ARANGO_USERNAME = os.getenv('ARANGO_USERNAME', '***ARANGO_USERNAME***')
    ARANGO_PASSWORD = os.getenv('ARANGO_PASSWORD', 'password')
    ARANGO_DB_NAME = os.getenv('ARANGO_DB_NAME', '***ARANGO_DB_NAME***')

    RABBITMQ_USER = os.getenv('RABBITMQ_USER', 'messenger')
    RABBITMQ_PASSWORD = os.getenv('RABBITMQ_PASSWORD', 'password')
    ANNOTATOR_QUEUE = os.getenv('ANNOTATOR_QUEUE', 'annotator')
    RABBITMQ_CONNECTION_URL = f'amqp://{RABBITMQ_USER}:{RABBITMQ_PASSWORD}@rabbitmq/'

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

    RQ_REDIS_URL = 'redis://:{password}@{host}:{port}/{db}'.format(
        host=os.getenv('REDIS_HOST', 'localhost'),
        port=os.getenv('REDIS_PORT', '6379'),
        password=os.getenv('REDIS_PASSWORD', ''),
        db=os.getenv('REDIS_DB', '1')
    )

    FORWARD_STACKTRACE = False

    # Uncomment to run jobs synchronously in-process (default is True)
    # ReF: https://flask-rq2.readthedocs.io/en/latest/#rq-async
    # RQ_ASYNC = False

    SUPPORTED_LOCALES = ['en']


class Development(Base):
    """Development configurations"""
    DOMAIN = 'http://localhost'

    ASSETS_DEBUG = True
    WTF_CSRF_ENABLED = False

    FORWARD_STACKTRACE = True


class QA(Base):
    """ QA configuration """
    SITE_NAME = 'Lifelike Knowledge Search (QA)'
    DOMAIN = 'https://qa.***ARANGO_DB_NAME***.bio'

    FORWARD_STACKTRACE = True


class Staging(Base):
    """Staging configurations"""
    SITE_NAME = 'Lifelike Knowledge Search (Staging)'
    DOMAIN = 'https://test.***ARANGO_DB_NAME***.bio'

    FORWARD_STACKTRACE = True


class Testing(Base):
    """Functional test configuration"""
    TESTING = True
    WTF_CSRF_ENABLED = False

    RQ_CONNECTION_CLASS = 'fakeredis.FakeStrictRedis'

    ARANGO_HOST = os.getenv('ARANGO_HOST', 'http://localhost:8529')
    ARANGO_DB_NAME = 'test_arango'

    FORWARD_STACKTRACE = True


class Production(Base):
    """ Production configuration """
    DOMAIN = 'https://kg.***ARANGO_DB_NAME***.bio'
    FORWARD_STACKTRACE = False
