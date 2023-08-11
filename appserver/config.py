import logging
import os

current_directory = os.path.realpath(os.path.dirname(__file__))


class Base:
    """Default values"""

    SITE_NAME = 'Lifelike Knowledge Search'

    # Optional for tracking the master branch for the build
    GITHUB_HASH = os.environ.get('GITHUB_HASH', '__VERSION__')
    GITHUB_LAST_COMMIT_TIMESTAMP = os.environ.get(
        'GITHUB_COMMIT_TIMESTAMP', 'undefined'
    )
    APP_BUILD_NUMBER = os.environ.get('APP_BUILD_NUMBER', 'undefined')
    APP_VERSION = os.environ.get('APP_VERSION', 'undefined')
    LOGGING_LEVEL = os.environ.get('LOGGING_LEVEL', logging.INFO)

    JWT_SECRET = os.environ.get('JWT_SECRET', 'secrets')
    JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
    # We need to make sure that if these are falsy (empty string, None, etc.), we use None
    JWKS_URL = os.environ.get('JWKS_URL', None) or None
    JWT_AUDIENCE = os.environ.get('JWT_AUDIENCE', None) or None

    POSTGRES_HOST = os.environ.get('POSTGRES_HOST')
    POSTGRES_PORT = os.environ.get('POSTGRES_PORT')
    POSTGRES_USER = os.environ.get('POSTGRES_USER')
    POSTGRES_PASSWORD = os.environ.get('POSTGRES_PASSWORD')
    POSTGRES_DB = os.environ.get('POSTGRES_DB')

    NEO4J_HOST = os.environ.get('NEO4J_HOST', '0.0.0.0')
    NEO4J_SCHEME = os.environ.get('NEO4J_SCHEME', 'bolt')
    NEO4J_AUTH = os.environ.get('NEO4J_AUTH', 'neo4j/password')
    NEO4J_PORT = os.environ.get('NEO4J_PORT', '7687')
    NEO4J_DATABASE = os.environ.get('NEO4J_DATABASE')

    ARANGO_HOST = os.environ.get('ARANGO_HOST', 'http://localhost:8529')
    ARANGO_USERNAME = os.environ.get('ARANGO_USERNAME', '***ARANGO_USERNAME***')
    ARANGO_PASSWORD = os.environ.get('ARANGO_PASSWORD', 'password')
    ARANGO_DB_NAME = os.environ.get('ARANGO_DB_NAME', '***ARANGO_DB_NAME***')

    AZURE_ACCOUNT_STORAGE_NAME = os.environ.get('AZURE_ACCOUNT_STORAGE_NAME')
    AZURE_ACCOUNT_STORAGE_KEY = os.environ.get('AZURE_ACCOUNT_STORAGE_KEY')
    AZURE_BLOB_STORAGE_URL = os.environ.get('AZURE_BLOB_STORAGE_URL')

    OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')

    SQLALCHEMY_DATABASE_URI = 'postgresql://%s:%s@%s:%s/%s' % (
        POSTGRES_USER,
        POSTGRES_PASSWORD,
        POSTGRES_HOST,
        POSTGRES_PORT,
        POSTGRES_DB,
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {'pool_pre_ping': True}

    SENTRY_ENABLED = False
    SENTRY_KEY = os.environ.get('SENTRY_KEY')

    ELASTIC_APM_SERVER_URL = os.environ.get('ELASTIC_APM_SERVER_URL', False)
    ELASTICSEARCH_HOSTS = os.environ.get('ELASTICSEARCH_HOSTS')
    ELASTIC_FILE_INDEX_ID = os.environ.get('ELASTIC_FILE_INDEX_ID')
    FILE_INDEX_DEFINITION_PATH = os.path.join(
        current_directory, './neo4japp/services/elastic/mappings/document_idx.json'
    )
    ELASTIC_INDEX_SEED_PAIRS = [
        (ELASTIC_FILE_INDEX_ID, FILE_INDEX_DEFINITION_PATH),
    ]

    # Set to 'True' for dev mode to have
    # the same format as staging.
    FORMAT_AS_JSON = os.environ.get('FORMAT_AS_JSON', False)

    FLASK_APP_CONFIG = os.environ.get('FLASK_APP_CONFIG')

    SE_HOST = os.environ.get('SE_HOST', 'statistical-enrichment')
    SE_PORT = os.environ.get('SE_PORT', '5010')

    NLP_SERVICE_ENDPOINT = os.environ.get(
        'NLP_SERVICE_ENDPOINT', 'https://nlp-api.***ARANGO_DB_NAME***.bio/v1/predict'
    )
    NLP_SERVICE_SECRET = os.environ.get('NLP_SERVICE_SECRET', '')
    REQUEST_TIMEOUT = int(os.environ.get('SERVICE_REQUEST_TIMEOUT', '60'))
    PARSER_RESOURCE_PULL_ENDPOINT = 'http://appserver:5000/annotations/files'
    PARSER_PDF_ENDPOINT = 'http://pdfparser:7600/token/rect/json/'
    PARSER_TEXT_ENDPOINT = 'http://pdfparser:7600/token/rect/text/json'

    LMDB_HOME_FOLDER = os.environ.get('LMDB_HOME_FOLDER')

    KEGG_ENABLED = bool(os.environ.get('KEGG_ENABLED', False))

    MAX_ALLOWED_LOGIN_FAILURES = int(os.environ.get('MAX_ALLOWED_LOGIN_FAILURES', '6'))
    MAILING_API_KEY = os.environ.get('SEND_GRID_EMAIL_API_KEY')

    ASSETS_PATH = os.environ.get('ASSETS_FOLDER') or '/home/n4j/assets/'

    REDIS_HOST = os.environ.get('REDIS_HOST', 'localhost')
    REDIS_PORT = port = os.environ.get('REDIS_PORT', '6379')
    REDIS_PASSWORD = os.environ.get('REDIS_PASSWORD', '')
    REDIS_SSL = os.environ.get('REDIS_SSL', 'false').lower() == 'true'
    CACHE_REDIS_DB = os.environ.get('CACHE_REDIS_DB', '0')
    CACHE_REDIS_URL = '{protocol}://:{password}@{host}:{port}/{db}'.format(
        protocol='rediss' if REDIS_SSL else 'redis',
        host=REDIS_HOST,
        port=REDIS_PORT,
        password=REDIS_PASSWORD,
        db=CACHE_REDIS_DB,
    )
    RQ_REDIS_DB = os.environ.get('RQ_REDIS_DB', '1')
    RQ_REDIS_URL = 'redis://:{password}@{host}:{port}/{db}'.format(
        host=REDIS_HOST, port=REDIS_PORT, password=REDIS_PASSWORD, db=RQ_REDIS_DB
    )

    FORWARD_STACKTRACE = False

    # Uncomment to run jobs synchronously in-process (default is True)
    # ReF: https://flask-rq2.readthedocs.io/en/latest/#rq-async
    # RQ_ASYNC = False

    SUPPORTED_LOCALES = ['en']

    CHAT_GPT_PLAYGROUND_ENABLED = (
        os.environ.get('CHAT_GPT_PLAYGROUND_ENABLED', 'false').lower() == 'true'
    )


class Development(Base):
    """Development configurations"""

    DOMAIN = 'http://localhost'

    LOGGING_LEVEL = logging.DEBUG

    ASSETS_DEBUG = True
    WTF_CSRF_ENABLED = False

    FORWARD_STACKTRACE = True

    CHAT_GPT_PLAYGROUND_ENABLED = True


class QA(Base):
    """QA configuration"""

    SITE_NAME = 'Lifelike Knowledge Search (QA)'
    DOMAIN = 'https://qa.***ARANGO_DB_NAME***.bio'

    LOGGING_LEVEL = logging.DEBUG

    FORWARD_STACKTRACE = True

    CHAT_GPT_PLAYGROUND_ENABLED = True


class Staging(Base):
    """Staging configurations"""

    SITE_NAME = 'Lifelike Knowledge Search (Staging)'
    DOMAIN = 'https://test.***ARANGO_DB_NAME***.bio'

    FORWARD_STACKTRACE = True
    SENTRY_ENABLED = True

    CHAT_GPT_PLAYGROUND_ENABLED = True


class Testing(Base):
    """Functional test configuration"""

    TESTING = True
    WTF_CSRF_ENABLED = False

    LOGGING_LEVEL = logging.DEBUG

    RQ_CONNECTION_CLASS = 'fakeredis.FakeStrictRedis'

    ARANGO_HOST = os.environ.get('ARANGO_HOST', 'http://localhost:8529')
    ARANGO_DB_NAME = 'test_arango'

    FORWARD_STACKTRACE = True

    CHAT_GPT_PLAYGROUND_ENABLED = True


class Production(Base):
    """Production configuration"""

    DOMAIN = 'https://kg.***ARANGO_DB_NAME***.bio'
    FORWARD_STACKTRACE = False
    SENTRY_ENABLED = True
