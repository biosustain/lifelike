import hashlib
import os

from elasticsearch import Elasticsearch
from flask import g
from flask_marshmallow import Marshmallow
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from jwt import PyJWKClient
from neo4j import Driver, GraphDatabase, basic_auth
from redis import Redis
from sqlalchemy import MetaData, Table, UniqueConstraint

from neo4japp.constants import BASE_REDIS_URL, CACHE_REDIS_DB, ELASTICSEARCH_HOSTS
from neo4japp.utils.flask import scope_flask_app_ctx

CACHE_REDIS_URL = f'{BASE_REDIS_URL}/{CACHE_REDIS_DB}'


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
    'fk': "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
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

# Note that this client should only be used when JWKS_URL has been configured!
jwt_client = PyJWKClient(os.getenv('JWKS_URL', ''))

_neo4j_driver: Driver = None


def get_neo4j_driver():
    global _neo4j_driver
    if _neo4j_driver is None:
        host = os.getenv('NEO4J_HOST', '0.0.0.0')
        scheme = os.getenv('NEO4J_SCHEME', 'bolt')
        port = os.getenv('NEO4J_PORT', '7687')
        url = f'{scheme}://{host}:{port}'
        username, password = os.getenv('NEO4J_AUTH', 'neo4j/password').split('/')
        _neo4j_driver = GraphDatabase.driver(url, auth=basic_auth(username, password))
    return _neo4j_driver


# TODO: with the DatabaseConnection class
# these functions that save to `g` are no longer needed
# remove them when possible
def get_neo4j_db():
    if not hasattr(g, 'neo4j_db'):
        graph = get_neo4j_driver()
        g.neo4j_db = graph.session()
    return g.neo4j_db


def close_neo4j_db(e=None):
    neo4j_db = g.pop('neo4j_db', None)
    if neo4j_db:
        neo4j_db.close()


def get_redis_connection(db: int = 0) -> Redis:
    if not hasattr(g, 'redis_conn'):
        g.redis_conn = Redis.from_url(CACHE_REDIS_URL)
    return g.redis_conn


def close_redis_conn(error):
    """Closes the database again at the end of the request."""
    redis_conn = g.pop('redis_conn', None)

    if redis_conn is not None:
        redis_conn.close()


def _connect_to_elastic():
    return Elasticsearch(
        timeout=180,
        hosts=ELASTICSEARCH_HOSTS
    )


class DBConnection:
    def __init__(self):
        super().__init__()
        self.session = db.session


class GraphConnection:
    def __init__(self):
        super().__init__()
        self.graph = get_neo4j_db()


class ElasticConnection:
    def __init__(self):
        super().__init__()
        self.elastic_client = _connect_to_elastic()


"""
TODO: Update all of these functions to use
DBConnection or GraphConnection above.

Separation of concerns/Single responsibility.

Better to selectively inherit the connection needed,
through different services. Separating graph service
from the postgres service.

It also helps avoid circular dependencies if these
get_*() functions are moved elsewhere. This problem does
not apply to the AnnotationServices (except manual and sorted).
"""


def get_kg_service():
    if 'kg_service' not in g:
        from neo4japp.services import KgService
        graph = get_neo4j_db()
        g.kg_service = KgService(
            graph=graph,
            session=db.session,
        )
    return g.kg_service


def get_visualizer_service():
    if 'visualizer_service' not in g:
        from neo4japp.services import VisualizerService
        graph = get_neo4j_db()
        g.visualizer_service = VisualizerService(
            graph=graph,
            session=db.session,
        )
    return g.visualizer_service


@scope_flask_app_ctx('file_type_service')
def get_file_type_service():
    """
    Return a service to figure out how to handle a certain type of file in our
    filesystem. When we add new file types to the system, we need to register
    its associated provider here.

    :return: the service
    """
    from neo4japp.services.file_types.service import FileTypeService, GenericFileTypeProvider
    from neo4japp.services.file_types.providers import EnrichmentTableTypeProvider, \
        PDFTypeProvider, BiocTypeProvider, \
        DirectoryTypeProvider, MapTypeProvider, GraphTypeProvider
    service = FileTypeService()
    service.register(GenericFileTypeProvider())
    service.register(DirectoryTypeProvider())
    service.register(PDFTypeProvider())
    service.register(BiocTypeProvider())
    service.register(MapTypeProvider())
    service.register(EnrichmentTableTypeProvider())
    service.register(GraphTypeProvider())
    return service


def get_enrichment_table_service():
    if 'enrichment_table_service' not in g:
        from neo4japp.services import EnrichmentTableService
        graph = get_neo4j_db()
        g.enrichment_table_service = EnrichmentTableService(
            graph=graph,
            session=db.session,
        )
    return g.enrichment_table_service


def get_search_service_dao():
    if 'search_dao' not in g:
        from neo4japp.services import SearchService
        graph = get_neo4j_db()
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
        g.elastic_service = ElasticService()
    return g.elastic_service


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
