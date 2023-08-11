from os import environ


class Base:
    """Default values"""

    JWT_SECRET = environ.get("JWT_SECRET", "secrets")
    JWT_ALGORITHM = environ.get("JWT_ALGORITHM", "HS256")
    # We need to make sure that if these are falsy (empty string, None, etc.), we use None
    JWKS_URL = environ.get('JWKS_URL', None) or None
    JWT_AUDIENCE = environ.get('JWT_AUDIENCE', None) or None


    ARANGO_HOST = environ.get('ARANGO_HOST', 'http://localhost:8529')
    ARANGO_USERNAME = environ.get('ARANGO_USERNAME', '***ARANGO_USERNAME***')
    ARANGO_PASSWORD = environ.get('ARANGO_PASSWORD', 'password')
    ARANGO_DB_NAME = environ.get('ARANGO_DB_NAME', '***ARANGO_DB_NAME***')
