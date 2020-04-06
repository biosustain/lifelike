import hashlib
import os

from flask import g
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from flask_marshmallow import Marshmallow
from py2neo import Graph
from sqlalchemy import MetaData, Table, UniqueConstraint


def trunc_long_constraint_name(name: str) -> str:
    if (len(name) > 59):
        truncated_name = name[:55] + '_' + \
            hashlib.md5(name[55:].encode('utf-8')).hexdigest()[:4]
        return truncated_name
    return name


def uq_trunc(unique_constraint: UniqueConstraint, table: Table):
    tokens = [table.name] + [
        column.name
        for column in unique_constraint.columns
    ]
    return trunc_long_constraint_name('_'.join(tokens))


convention = {
    'uq_trunc': uq_trunc,
    'ix': 'ix_%(column_0_label)s',
    'uq': "uq_%(uq_trunc)s",
    'ck': "ck_%(table_name)s_%(constraint_name)s",
    'fk': "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",  # noqa
    'pk': "pk_%(table_name)s"
}

metadata = MetaData(naming_convention=convention)

# TODO: Set these in a more appropriate location
# TODO: Handle database connection properly
graph = Graph(
    uri=os.environ.get('NEO4J_HOST'),
    password=os.environ.get('NEO4J_USER')
)

db = SQLAlchemy(metadata=metadata)
ma = Marshmallow()
migrate = Migrate(compare_type=True)


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


def get_annotations_service():
    if 'annotations_service' not in g:
        from neo4japp.services.annotations import AnnotationsService, LMDBDao
        lmdb_dao = LMDBDao()
        g.annotations_service = AnnotationsService(lmdb_session=lmdb_dao)
    return g.annotations_service


def get_token_extractor_service():
    if 'token_extractor_service' not in g:
        from neo4japp.services.annotations import TokenExtractor
        g.token_extractor_service = TokenExtractor()
    return g.token_extractor_service


def get_bioc_document_service():
    if 'bioc_document_service' not in g:
        from neo4japp.services.annotations import BiocDocumentService
        g.bioc_document_service = BiocDocumentService()
    return g.bioc_document_service


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
        'account_service',
        'annotations_service',
        'token_extractor_service',
        'bioc_document_service',
    ]:
        if dao in g:
            g.pop(dao)
