import os
from flask import g
from py2neo import Graph

# TODO: Set these in a more appropriate location
# TODO: Handle database connection properly
graph = Graph(
    uri=os.environ.get('NEO4J_HOST'),
    password=os.environ.get('NEO4J_USER')
)

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
