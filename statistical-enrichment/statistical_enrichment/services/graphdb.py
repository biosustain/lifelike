import os

from flask import g
from neo4j import GraphDatabase, basic_auth

host = os.getenv('NEO4J_HOST', '0.0.0.0')
scheme = os.getenv('NEO4J_SCHEME', 'bolt')
port = os.getenv('NEO4J_PORT', '7687')
url = f'{scheme}://{host}:{port}'
username, password = os.getenv('NEO4J_AUTH', 'neo4j/password').split('/')
driver = GraphDatabase.driver(url, auth=basic_auth(username, password))

def get_neo4j_db():
    if not hasattr(g, 'neo4j_db'):
        g.neo4j_db = driver.session()
    return g.neo4j_db
