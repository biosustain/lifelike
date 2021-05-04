import hashlib
import os

from flask import g, current_app
from flask_marshmallow import Marshmallow
from neo4j import GraphDatabase, basic_auth
from py2neo import Graph


def trunc_long_constraint_name(name: str) -> str:
    if (len(name) > 59):
        truncated_name = name[:55] + '_' + \
                         hashlib.md5(name[55:].encode('utf-8')).hexdigest()[:4]
        return truncated_name
    return name

ma = Marshmallow()

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


def close_neo4j_db(_=None):
    neo4j_db = g.pop('neo4j_db', None)
    if neo4j_db:
        neo4j_db.close()


# NOTE: local network connection to cloud seems to be causing issues
# Neo4j Lead Dev/Py2neo creator: https://stackoverflow.com/a/63592570
# https://github.com/technige/py2neo
# TODO: how to close connection? Py2neo doesn't seem to do this...
def connect_to_neo4j():
    if 'neo4j' not in g:
        protocols = ['bolts', 'bolt+s', 'bolt+ssc', 'https', 'http+s', 'http+ssc']
        secure = current_app.config.get('NEO4J_SCHEME', 'bolt')
        g.neo4j = Graph(
                name=current_app.config.get('NEO4J_DATABASE'),
                host=current_app.config.get('NEO4J_HOST'),
                auth=current_app.config.get('NEO4J_AUTH').split('/'),
                secure=secure in protocols,
                port=current_app.config.get('NEO4J_PORT'),
                scheme=current_app.config.get('NEO4J_SCHEME')
        )
    return g.neo4j



