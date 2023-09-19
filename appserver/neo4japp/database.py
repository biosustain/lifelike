import hashlib

from arango import ArangoClient
from arango.http import DefaultHTTPClient
from elasticsearch import Elasticsearch
from flask import g, current_app
from flask_marshmallow import Marshmallow
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from jwt import PyJWKClient
from redis import Redis
from sqlalchemy import MetaData, Table, UniqueConstraint
from typing import Union

from neo4japp.utils.flask import scope_flask_app_ctx
from neo4japp.utils.globals import config


def trunc_long_constraint_name(name: str) -> str:
    if len(name) > 59:
        truncated_name = (
            name[:55] + '_' + hashlib.md5(name[55:].encode('utf-8')).hexdigest()[:4]
        )
        return truncated_name
    return name


def uq_trunc(unique_constraint: UniqueConstraint, table: Table):
    tokens = [table.name] + [column.name for column in unique_constraint.columns]
    return trunc_long_constraint_name('_'.join(tokens))


convention = {
    'uq_trunc': uq_trunc,
    'ix': 'ix_%(column_0_label)s',
    'uq': "uq_%(uq_trunc)s",
    'ck': "ck_%(table_name)s_%(constraint_name)s",
    'fk': "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    'pk': "pk_%(table_name)s",
}

ma = Marshmallow()
migrate = Migrate(compare_type=True)
metadata = MetaData(naming_convention=convention)
db = SQLAlchemy(
    metadata=metadata,
    engine_options={
        'executemany_mode': 'values',
        'executemany_values_page_size': 10000,
    },
)

_jwt_client: Union[PyJWKClient, None] = None


# Note that this client should only be used when JWKS_URL has been configured!
def get_jwt_client():
    global _jwt_client
    if _jwt_client is None:
        _jwt_client = PyJWKClient(config.get('JWKS_URL', ''))
    return _jwt_client


def get_redis_connection() -> Redis:
    if not hasattr(g, 'redis_conn'):
        g.redis_conn = Redis.from_url(config.get('RQ_REDIS_URL'))
    return g.redis_conn


def close_redis_conn(error):
    """Closes the database again at the end of the request."""
    redis_conn = g.pop('redis_conn', None)

    if redis_conn is not None:
        redis_conn.close()


def _connect_to_elastic():
    return Elasticsearch(timeout=180, hosts=[config.get('ELASTICSEARCH_HOSTS')])


def create_arango_client(hosts=None) -> ArangoClient:
    # Need a custom HTTP client for Arango because the default timeout is only 60s
    class CustomHTTPClient(DefaultHTTPClient):
        REQUEST_TIMEOUT = 1000

    hosts = hosts or current_app.config.get('ARANGO_HOST')
    return ArangoClient(
        hosts=hosts,
        # Without this setting any requests to Arango will fail because we don't have a valid cert
        verify_override=False,
        http_client=CustomHTTPClient(),
    )


def close_arango_client(error):
    """Closes the database again at the end of the request."""
    arango_client = g.pop("arango_client", None)

    if arango_client is not None:
        arango_client.close()


class DBConnection:
    def __init__(self):
        super().__init__()
        self.session = db.session


class ElasticConnection:
    def __init__(self):
        super().__init__()
        self.elastic_client = _connect_to_elastic()


"""
TODO: Update all of these functions to use
DBConnection above.

Separation of concerns/Single responsibility.

Better to selectively inherit the connection needed,
through different services. Separating graph service
from the postgres service.

It also helps avoid circular dependencies if these
get_*() functions are moved elsewhere. This problem does
not apply to the AnnotationServices (except manual and sorted).
"""


@scope_flask_app_ctx('file_type_service')
def get_file_type_service():
    """
    Return a service to figure out how to handle a certain type of file in our
    filesystem. When we add new file types to the system, we need to register
    its associated provider here.

    :return: the service
    """
    from neo4japp.services.file_types.service import (
        FileTypeService,
        GenericFileTypeProvider,
    )
    from neo4japp.services.file_types.providers import (
        EnrichmentTableTypeProvider,
        PDFTypeProvider,
        BiocTypeProvider,
        DirectoryTypeProvider,
        MapTypeProvider,
        GraphTypeProvider,
    )

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

        g.enrichment_table_service = EnrichmentTableService(session=db.session)
    return g.enrichment_table_service


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


def get_or_create_arango_client() -> ArangoClient:
    if not hasattr(g, "arango_conn"):
        g.arango_client = create_arango_client()
    return g.arango_client


def reset_dao():
    """Cleans up DAO bound to flask request context

    Used in functional test fixture, but may come in
    handy for production later.
    """
    for dao in [
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
