import os


class Base:
    """Default values"""

    JWKS_URL = os.environ.get('JWKS_URL', None)
    JWT_SECRET = os.environ.get('JWT_SECRET', 'secrets')
    JWT_AUDIENCE = os.environ.get('JWT_AUDIENCE', None)
    JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')

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
        POSTGRES_DB,
    )

    NEO4J_HOST = os.environ.get('NEO4J_HOST', '0.0.0.0')
    NEO4J_SCHEME = os.environ.get('NEO4J_SCHEME', 'bolt')
    NEO4J_AUTH = os.environ.get('NEO4J_AUTH', 'neo4j/password')
    NEO4J_PORT = os.environ.get('NEO4J_PORT', '7687')
    NEO4J_DATABASE = os.environ.get('NEO4J_DATABASE')

    ARANGO_HOST = os.environ.get('ARANGO_HOST', 'http://localhost:8529')
    ARANGO_USERNAME = os.environ.get('ARANGO_USERNAME', '***ARANGO_USERNAME***')
    ARANGO_PASSWORD = os.environ.get('ARANGO_PASSWORD', 'password')
    ARANGO_DB_NAME = os.environ.get('ARANGO_DB_NAME', '***ARANGO_DB_NAME***')

    OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')

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

    # Optional for tracking the master branch for the build
    GITHUB_HASH = os.environ.get('GITHUB_HASH', '__VERSION__')

    FORWARD_STACKTRACE = False
