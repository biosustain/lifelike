from os import environ

class Base():
    """Default values"""
    JWKS_URL = environ.get('JWKS_URL', None)
    JWT_SECRET = environ.get('JWT_SECRET', 'secrets')

    NEO4J_HOST = environ.get('NEO4J_HOST')
    NEO4J_SCHEME = environ.get('NEO4J_SCHEME')
    NEO4J_AUTH = environ.get('NEO4J_AUTH')
    NEO4J_PORT = environ.get('NEO4J_PORT')
    NEO4J_DATABASE = environ.get('NEO4J_DATABASE')
