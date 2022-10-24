from os import getenv

class Base():
    """Default values"""
    JWKS_URL = getenv('JWKS_URL', None)
    JWT_SECRET = getenv('JWT_SECRET', 'secrets')
    JWT_ALGORITHM = getenv('JWT_ALGORITHM', 'HS256')
    JWT_AUDIENCE = getenv('JWT_AUDIENCE', None)

    NEO4J_HOST = getenv('NEO4J_HOST', 'localhost')
    NEO4J_SCHEME = getenv('NEO4J_SCHEME', 'bolt')
    NEO4J_AUTH = getenv('NEO4J_AUTH', 'neo4j/password')
    NEO4J_PORT = getenv('NEO4J_PORT', '7687')
    NEO4J_DATABASE = getenv('NEO4J_DATABASE', 'neo4j')
