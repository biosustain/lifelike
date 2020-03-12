import pytest
import os

from py2neo import Graph, Node

from neo4japp.services.common import BaseDao
from neo4japp.factory import create_app
from neo4japp.services import (
    Neo4JService,
    SearchService,
)

@pytest.fixture(scope='session')
def app(request):
    """Session-wide test Flask application."""
    app = create_app('Functional Test Flask App', config='config.Testing')

    # Establish an application context before running the tests.
    ctx = app.app_context()
    ctx.push()

    def teardown():
        ctx.pop()

    request.addfinalizer(teardown)
    return app


@pytest.fixture(scope='function')
def graph(app):
    """Returns a graph connection to the Neo4J database.
    IMPORTANT: Tests may not behave as expected if the
    Neo4J database is not cleared before running tests!
    """
    graph = Graph(
        uri=os.environ.get('NEO4J_HOST'),
        password=os.environ.get('NEO4J_USER')
    )
    return graph

##### Begin DAO Fixtures #####

@pytest.fixture(scope='function')
def base_dao(graph):
    """For testing methods in BaseDao"""
    return BaseDao(graph)


@pytest.fixture(scope='function')
def neo4j_service_dao(graph):
    """Neo4JService using the test graph"""
    return Neo4JService(graph)


@pytest.fixture(scope='function')
def search_service_dao(graph):
    """SearchService using the test graph"""
    return SearchService(graph)

##### End DAO Fixtures #####

##### Begin Graph Data Fixtures #####

@pytest.fixture(scope='function')
def gas_gangrene(request, graph):
    tx = graph.begin()

    gas_gangrene = Node('Disease', name='gas gangrene', id='MESH:D005738')

    tx.create(gas_gangrene)
    tx.commit()

    def teardown():
        teardown_tx = graph.begin()
        teardown_tx.delete(gas_gangrene)
        teardown_tx.commit()

    request.addfinalizer(teardown)

    return gas_gangrene
