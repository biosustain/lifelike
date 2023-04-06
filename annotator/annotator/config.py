from os import environ

class Base():
    """Default values"""
    ARANGO_HOST = environ.get('ARANGO_HOST', 'http://localhost:8529')
    ARANGO_USERNAME = environ.get('ARANGO_USERNAME', '***ARANGO_USERNAME***')
    ARANGO_PASSWORD = environ.get('ARANGO_PASSWORD', 'password')
    ARANGO_DB_NAME = environ.get('ARANGO_DB_NAME', '***ARANGO_DB_NAME***')
