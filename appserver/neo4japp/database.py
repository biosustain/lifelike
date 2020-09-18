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

metadata = MetaData(naming_convention=convention)

# TODO: Set these in a more appropriate location
# TODO: Handle database connection properly

db = SQLAlchemy(metadata=metadata)
ma = Marshmallow()
migrate = Migrate(compare_type=True)


def _connect_to_neo4j():
    return Graph(
        host=current_app.config.get("NEO4J_HOST"),
        auth=current_app.config.get('NEO4J_AUTH').split('/'),
        # max time in seconds to keep connection in pool
        # good for long processing before querying the graph
        # as the connection could be stale and the pool
        # is maxed out so new connections can't be added
        max_age=60,
    )


def _connect_to_elastic():
    return Elasticsearch(
        timeout=180,
        hosts=[os.environ.get('ELASTICSEARCH_HOSTS')]
    )


def get_neo4j():
    """ Get a Neo4j Database Connection """
    if 'neo4j' not in g:
        g.neo4j = _connect_to_neo4j()
    return g.neo4j


def get_kg_service():
    if 'kg_service' not in g:
        from neo4japp.services import KgService
        graph = _connect_to_neo4j()
        g.kg_service = KgService(
            graph=graph,
            session=db.session,
        )
    return g.kg_service


def get_visualizer_service():
    if 'visualizer_service' not in g:
        from neo4japp.services import VisualizerService
        graph = _connect_to_neo4j()
        g.visualizer_service = VisualizerService(
            graph=graph,
            session=db.session,
        )
    return g.visualizer_service


def get_user_file_import_service():
    if 'user_file_import_service' not in g:
        from neo4japp.services import UserFileImportService
        graph = _connect_to_neo4j()
        g.current_user_file_import_service = UserFileImportService(graph=graph, session=db.session)
    return g.current_user_file_import_service


def get_search_service_dao():
    if 'search_dao' not in g:
        from neo4japp.services import SearchService
        graph = _connect_to_neo4j()
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


def get_elastic_index_service():
    if 'elastic_index_service' not in g:
        from neo4japp.services.indexing import ElasticIndexService
        elastic = _connect_to_elastic()
        g.elastic_index_service = ElasticIndexService(elastic=elastic)
    return g.elastic_index_service


def get_lmdb_dao():
    if 'lmdb_dao' not in g:
        from neo4japp.services.annotations import LMDBDao
        g.lmdb_dao = LMDBDao()
    return g.lmdb_dao


def close_lmdb(e=None):
    lmdb_dao = g.pop('lmdb_dao', None)
    if lmdb_dao:
        lmdb_dao.close_envs()


def get_annotation_neo4j():
    if 'annotation_neo4j' not in g:
        from neo4japp.services.annotations import AnnotationsNeo4jService
        graph = _connect_to_neo4j()
        g.annotation_neo4j = AnnotationsNeo4jService(
            session=db.session,
            graph=graph,
        )
    return g.annotation_neo4j


def get_annotations_service(lmdb_dao):
    from neo4japp.services.annotations import AnnotationsService
    return AnnotationsService(
        lmdb_session=lmdb_dao,
        annotation_neo4j=get_annotation_neo4j(),
    )


def get_manual_annotations_service():
    from neo4japp.services.annotations import ManualAnnotationsService
    return ManualAnnotationsService()


def get_annotations_pdf_parser():
    from neo4japp.services.annotations import AnnotationsPDFParser
    return AnnotationsPDFParser()


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
        'lmdb_dao',
        'annotation_neo4j',
        'visualizer_service',
    ]:
        if dao in g:
            g.pop(dao)
