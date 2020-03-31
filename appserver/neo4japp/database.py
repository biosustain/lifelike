import os
from flask import g, current_app
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from flask_marshmallow import Marshmallow
from py2neo import Graph

# TODO: Set these in a more appropriate location
# TODO: Handle database connection properly

db = SQLAlchemy()
ma = Marshmallow()
migrate = Migrate()


def _connect_to_neo4j():
    return Graph(
        host=current_app.config.get("NEO4J_HOST"),
        auth=current_app.config.get('NEO4J_AUTH').split('/'),
    )


def get_neo4j():
    """ Get a Neo4j Database Connection """
    if 'neo4j' not in g:
        g.neo4j = _connect_to_neo4j()
    return g.neo4j


def get_neo4j_service_dao():
    if 'neo4j_dao' not in g:
        from neo4japp.services import Neo4JService
        graph = _connect_to_neo4j()
        g.neo4j_service_dao = Neo4JService(graph)
    return g.neo4j_service_dao


def get_user_file_import_service():
    if 'user_file_import_service' not in g:
        from neo4japp.services import UserFileImportService
        graph = _connect_to_neo4j()
        g.user_file_import_service = UserFileImportService(graph)
    return g.user_file_import_service


def get_search_service_dao():
    if 'search_dao' not in g:
        from neo4japp.services import SearchService
        graph = _connect_to_neo4j()
        g.search_service_dao = SearchService(graph)
    return g.search_service_dao


def get_authorization_service():
    if 'authorization_service' not in g:
        from neo4japp.services import AuthService
        g.authorization_service = AuthService(db.session)
    return g.authorization_service


def get_account_service():
    if 'account_service' not in g:
        from neo4japp.services import AccountService
        g.account_service = AccountService(db.session)
    return g.account_service


def reset_dao():
    """ Cleans up DAO bound to flask request context

    Used in functional test fixture, but may come in
    handy for production later.
    """
    for dao in [
        'neo4j_dao',
        'user_file_import_service',
        'search_dao',
        'authorization_service',
        'account_service'
    ]:
        if dao in g:
            g.pop(dao)
