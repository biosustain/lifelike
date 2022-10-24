from os import getenv

class Base():
    """Default values"""
    JWKS_URL = getenv('JWKS_URL', None)
    JWT_SECRET = getenv('JWT_SECRET', 'secrets')
    JWT_ALGORITHM = getenv('JWT_ALGORITHM', 'HS256')
    JWT_AUDIENCE = getenv('JWT_AUDIENCE', None)

    ARANGO_HOST = getenv('ARANGO_HOST', 'http://localhost:8529')
    ARANGO_USERNAME = getenv('ARANGO_USERNAME', '***ARANGO_USERNAME***')
    ARANGO_PASSWORD = getenv('ARANGO_PASSWORD', 'password')
    ARANGO_DB_NAME = getenv('ARANGO_DB_NAME', '***ARANGO_DB_NAME***')
