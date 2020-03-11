import os
from flask import g
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from flask_marshmallow import Marshmallow
from py2neo import Graph

# TODO: Set these in a more appropriate location
# TODO: Handle database connection properly
graph = Graph(
    uri=os.environ.get('NEO4J_HOST'),
    password=os.environ.get('NEO4J_USER')
)

db = SQLAlchemy()
ma = Marshmallow()
migrate = Migrate()

def get_neo4j_service_dao():
    if 'neo4j_dao' not in g:
        from neo4japp.services import Neo4JService
        g.neo4j_service_dao = Neo4JService(graph)
    return g.neo4j_service_dao


def get_user_file_import_service():
    if 'user_file_import_service' not in g:
        from neo4japp.services import UserFileImportService
        g.user_file_import_service = UserFileImportService(graph)
    return g.user_file_import_service


def get_search_service_dao():
    if 'search_dao' not in g:
        from neo4japp.services import SearchService
        g.search_service_dao = SearchService(graph)
    return g.search_service_dao
