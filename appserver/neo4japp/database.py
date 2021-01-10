import hashlib
import os

from elasticsearch import Elasticsearch
from flask import g, current_app
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

ma = Marshmallow()
migrate = Migrate(compare_type=True)
metadata = MetaData(naming_convention=convention)
db = SQLAlchemy(
    metadata=metadata,
    engine_options={
        'executemany_mode': 'values',
        'executemany_values_page_size': 10000
    }
)


# NOTE: local network connection to cloud seems to be causing issues
# Neo4j Lead Dev/Py2neo creator: https://stackoverflow.com/a/63592570
# https://github.com/technige/py2neo
# TODO: how to close connection? Py2neo doesn't seem to do this...
def connect_to_neo4j():
    if 'neo4j' not in g:
        g.neo4j = Graph(
            host=current_app.config.get('NEO4J_HOST'),
            auth=current_app.config.get('NEO4J_AUTH').split('/'),
        )
    return g.neo4j


def connect_to_lmdb():
    if 'lmdb' not in g:
        from neo4japp.services.annotations.lmdb_access import LMDB
        g.lmdb = LMDB()
        g.lmdb.open_envs()
    return g.lmdb


def close_lmdb(e=None):
    lmdb = g.pop('lmdb', None)
    if lmdb:
        lmdb.close_envs()


class LMDBConnection:
    def __init__(self):
        super().__init__()
        self.session = connect_to_lmdb()


class DBConnection:
    def __init__(self):
        super().__init__()
        self.session = db.session


class GraphConnection:
    def __init__(self):
        super().__init__()
        self.graph = connect_to_neo4j()


def _connect_to_elastic():
    return Elasticsearch(
        timeout=180,
        hosts=[os.environ.get('ELASTICSEARCH_HOSTS')]
    )


"""
TODO: Update all of these functions to use
DBConnection or GraphConnection above.

Separation of concerns/Single responsibility.

Better to selectively inherit the connection needed,
through different services. Separating graph service
from the postgres service.
"""


def get_kg_service():
    if 'kg_service' not in g:
        from neo4japp.services import KgService
        graph = connect_to_neo4j()
        g.kg_service = KgService(
            graph=graph,
            session=db.session,
        )
    return g.kg_service


def get_visualizer_service():
    if 'visualizer_service' not in g:
        from neo4japp.services import VisualizerService
        graph = connect_to_neo4j()
        g.visualizer_service = VisualizerService(
            graph=graph,
            session=db.session,
        )
    return g.visualizer_service


def get_enrichment_table_service():
    if 'enrichment_table_service' not in g:
        from neo4japp.services import EnrichmentTableService
        graph = connect_to_neo4j()
        g.enrichment_table_service = EnrichmentTableService(
            graph=graph,
            session=db.session,
        )
    return g.enrichment_table_service


def get_user_file_import_service():
    if 'user_file_import_service' not in g:
        from neo4japp.services import UserFileImportService
        graph = connect_to_neo4j()
        g.current_user_file_import_service = UserFileImportService(graph=graph, session=db.session)
    return g.current_user_file_import_service


def get_search_service_dao():
    if 'search_dao' not in g:
        from neo4japp.services import SearchService
        graph = connect_to_neo4j()
        g.search_service_dao = SearchService(graph=graph)
    return g.search_service_dao


def get_authorization_service():
    if 'authorization_service' not in g:
        from neo4japp.services import AuthService
        g.authorization_service = AuthService(session=db.session)
    return g.authorization_service


def get_account_service():
    if 'account_service' not in g:
        from neo4japp.services import AccountService
        g.account_service = AccountService(session=db.session)
    return g.account_service


def get_projects_service():
    if 'projects_service' not in g:
        from neo4japp.services import ProjectsService
        g.projects_service = ProjectsService(session=db.session)
    return g.projects_service


def get_elastic_service():
    if 'elastic_service' not in g:
        from neo4japp.services.elastic import ElasticService
        elastic = _connect_to_elastic()
        g.elastic_service = ElasticService(elastic=elastic)
    return g.elastic_service


def get_annotation_service():
    from neo4japp.services.annotations import (
        AnnotationService,
        AnnotationDBService,
        AnnotationGraphService
    )
    return AnnotationService(
        db=AnnotationDBService(),
        graph=AnnotationGraphService()
    )


def get_entity_recognition():
    from neo4japp.services.annotations import (
        AnnotationDBService,
        AnnotationGraphService,
        EntityRecognitionService,
        LMDBService
    )
    return EntityRecognitionService(
        lmdb=LMDBService(),
        db=AnnotationDBService(),
        graph=AnnotationGraphService()
    )


def get_manual_annotation_service():
    from neo4japp.services.annotations import (
        AnnotationGraphService,
        ManualAnnotationService
    )
    return ManualAnnotationService(
        graph=AnnotationGraphService()
    )


def get_bioc_document_service():
    from neo4japp.services.annotations import BiocDocumentService
    return BiocDocumentService()


def get_excel_export_service():
    from neo4japp.services.export import ExcelExportService
    return ExcelExportService()


def reset_dao():
    """ Cleans up DAO bound to flask request context

    Used in functional test fixture, but may come in
    handy for production later.
    """
    for dao in [
        'kg_service',
        'user_file_import_service',
        'search_dao',
        'authorization_service',
        'account_service',
        'projects_service',
        'visualizer_service',
        'neo4j',
    ]:
        if dao in g:
            g.pop(dao)
