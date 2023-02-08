from arango import ArangoClient
from arango.database import StandardDatabase
from arango.graph import Graph
from flask import request as flask_request
from flask.app import Flask
from pathlib import Path
import pytest
import os
import responses

from neo4japp.blueprints.auth import auth
from neo4japp.database import create_arango_client, db, reset_dao
from neo4japp.factory import create_app
from neo4japp.services import AccountService, AuthService
from neo4japp.services.arangodb import create_db, get_db
from neo4japp.services.elastic import ElasticService

from .constants import DOCUMENT_COLLECTIONS, EDGE_COLLECTIONS, GRAPHS


def setup_before_request_callbacks(app: Flask):
    login_required_dummy_view = auth.login_required(lambda: None)

    @app.before_request
    def default_login_required():
        # exclude 404 errors and static routes
        # uses split to handle blueprint static routes as well
        if not flask_request.endpoint or flask_request.endpoint.rsplit('.', 1)[-1] == 'static':
            return

        view = app.view_functions[flask_request.endpoint]

        if getattr(view, 'login_exempt', False):
            return

        return login_required_dummy_view()


def setup_request_callbacks(app: Flask):
    setup_before_request_callbacks(app)


@pytest.fixture(scope='function')
def app(request) -> Flask:
    """Session-wide test Flask application."""
    app: Flask = create_app('Functional Test Flask App', config='config.Testing')

    setup_request_callbacks(app)

    # Establish an application context before running the tests.
    ctx = app.app_context()
    ctx.push()

    def teardown():
        ctx.pop()

    request.addfinalizer(teardown)
    return app


@pytest.fixture(scope='function')
def session(app, request):
    """ Creates a new database session """
    connection = db.engine.connect()
    transaction = connection.begin()
    options = {'bind': connection, 'binds': {}}
    session = db.create_scoped_session(options=options)
    db.session = session

    def teardown():
        transaction.rollback()
        connection.close()
        session.remove()
        reset_dao()

    request.addfinalizer(teardown)
    return session


# Arango fixtures
@pytest.fixture(scope="function")
def arango_client(app):
    arango_client = create_arango_client(
        hosts=app.config.get('ARANGO_HOST')
    )

    yield arango_client

    arango_client.close()


@pytest.fixture(scope="function")
def system_db(app, arango_client: ArangoClient):
    return get_db(
        arango_client=arango_client,
        name="_system",
        username=app.config.get("ARANGO_USERNAME"),
        password=app.config.get("ARANGO_PASSWORD"),
    )


def _create_empty_document_collections(arango_db: StandardDatabase):
    for collection in DOCUMENT_COLLECTIONS:
        arango_db.create_collection(collection)


def _create_empty_edge_collections(arango_db: StandardDatabase):
    for collection in EDGE_COLLECTIONS:
        arango_db.create_collection(collection, edge=True)


def _create_empty_graphs(arango_db: StandardDatabase):
    edge_definitions = [
        {
            'edge_collection': edge_collection,
            'from_vertex_collections': DOCUMENT_COLLECTIONS,
            'to_vertex_collections': DOCUMENT_COLLECTIONS,
        }
        for edge_collection in EDGE_COLLECTIONS
    ]
    for graph in GRAPHS:
        arango_db.create_graph(graph, edge_definitions)


@pytest.fixture(scope="function")
def test_arango_db(
    app, arango_client: ArangoClient, system_db: StandardDatabase
):
    test_db_name = app.config.get('ARANGO_DB_NAME')
    create_db(system_db, test_db_name)

    test_db = get_db(
        arango_client=arango_client,
        name=test_db_name,
        username=app.config.get('ARANGO_USERNAME'),
        password=app.config.get('ARANGO_PASSWORD'),
    )

    _create_empty_document_collections(test_db)
    _create_empty_edge_collections(test_db)
    _create_empty_graphs(test_db)

    yield test_db

    # Drop the test database after every test to make it clean before the next one
    system_db.delete_database(test_db_name)

@pytest.fixture(scope='function')
def test_arango_all_graph(test_arango_db: StandardDatabase):
    return test_arango_db.graph('all')


@pytest.fixture(scope='function')
def associated_edge_collection(test_arango_all_graph: Graph):
    return test_arango_all_graph.edge_collection('associated')


@pytest.fixture(scope='function')
def has_association_edge_collection(test_arango_all_graph: Graph):
    return test_arango_all_graph.edge_collection('has_association')


@pytest.fixture(scope='function')
def indicates_edge_collection(test_arango_all_graph: Graph):
    return test_arango_all_graph.edge_collection('indicates')


@pytest.fixture(scope='function')
def in_pub_edge_collection(test_arango_all_graph: Graph):
    return test_arango_all_graph.edge_collection('in_pub')


@pytest.fixture(scope='function')
def account_service(app, session):
    return AccountService(session)


@pytest.fixture(scope='function')
def auth_service(app, session):
    return AuthService(session)


@pytest.fixture(scope='function')
def account_user(app, session):
    return AccountService(session)


@pytest.fixture(scope='function')
def elastic_service(app, session):
    elastic_service = ElasticService()

    # Ensures that anytime the elastic service is requested for a test, that the environment is
    # clean
    elastic_service.recreate_indices_and_pipelines()

    return elastic_service


@pytest.fixture(scope='session')
def pdf_dir() -> str:
    """ Returns the directory of the example PDFs """
    return os.path.join(Path(__file__).parent, 'database', 'services', 'annotations', 'pdf_samples')


@pytest.fixture
def mocked_responses():
    with responses.RequestsMock() as rsps:
        yield rsps
