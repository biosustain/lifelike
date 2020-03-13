import pytest
import os

from py2neo import (
    Graph,
    Node,
    Relationship,
)

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
def graph(request, app):
    """Returns a graph connection to the Neo4J database.
    IMPORTANT: Tests may not behave as expected if the
    Neo4J database is not cleared before running tests!
    """
    graph = Graph(
        uri=os.environ.get('NEO4J_HOST'),
        password=os.environ.get('NEO4J_USER')
    )

    # Deletes all nodes and relationships at the conclusion of every test
    def teardown():
        graph.run("MATCH(n) DETACH DELETE n")
        graph

    request.addfinalizer(teardown)

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

### Begin Entity Node Fixtures ###

@pytest.fixture(scope='function')
def gas_gangrene(graph):
    """Creates a disease node and adds it to the graph."""
    tx = graph.begin()

    gas_gangrene = Node('Disease', name='gas gangrene', id='MESH:D005738')

    tx.create(gas_gangrene)
    tx.commit()

    return gas_gangrene


@pytest.fixture(scope='function')
def penicillins(graph):
    """Creates a chemical node and adds it to the graph."""
    tx = graph.begin()

    penicillins = Node('Chemical', name='Penicillins', id='MESH:D010406')

    tx.create(penicillins)
    tx.commit()

    return penicillins


@pytest.fixture(scope='function')
def pomc(graph):
    """Creates a gene node and adds it to the graph."""
    tx = graph.begin()

    pomc = Node('Gene', name='POMC', gene_id='5443')

    tx.create(pomc)
    tx.commit()

    return pomc

### End Entity Nodes Fixtures ###

### Begin Entity -> Entity Relationship Fixtures ###

@pytest.fixture(scope='function')
def pomc_to_gas_gangrene_pathogenesis_edge(
    graph,
    gas_gangrene,
    pomc,
):
    """Creates an ASSOCIATED relationship from pomc to gas gangrene and
    adds it to the graph."""
    tx = graph.begin()

    pomc_to_gas_gangrene_pathogenesis_edge = Relationship(
            pomc, 'ASSOCIATED', gas_gangrene,
            assoc_type='J',
            description='role in disease pathogenesis',
    )

    tx.create(pomc_to_gas_gangrene_pathogenesis_edge)
    tx.commit()

    return pomc_to_gas_gangrene_pathogenesis_edge

@pytest.fixture(scope='function')
def penicillins_to_gas_gangrene_alleviates_edge(
    graph,
    gas_gangrene,
    penicillins,
):
    """Creates an ASSOCIATED relationship from penicillins to gas
    gangrene and adds it to the graph."""
    tx = graph.begin()

    penicillins_to_gas_gangrene_alleviates_edge = Relationship(
        penicillins, 'ASSOCIATED', gas_gangrene,
        assoc_type='Pa',
        description='alleviates, reduces',
    )

    tx.create(penicillins_to_gas_gangrene_alleviates_edge)
    tx.commit()

    return penicillins_to_gas_gangrene_alleviates_edge


@pytest.fixture(scope='function')
def penicillins_to_gas_gangrene_treatment_edge(
    graph,
    gas_gangrene,
    penicillins,
):
    """Creates an ASSOCIATED relationship from penicillins to gas
    gangrene and adds it to the graph."""
    tx = graph.begin()

    penicillins_to_gas_gangrene_treatment_edge = Relationship(
        penicillins, 'ASSOCIATED', gas_gangrene,
        assoc_type='J',
        description='treatment/therapy (including investigatory)' ,
    )
    tx.create(penicillins_to_gas_gangrene_treatment_edge)
    tx.commit()

    return penicillins_to_gas_gangrene_treatment_edge

### End Entity -> Entity Relationship Fixtures ###


@pytest.fixture(scope='function')
def gas_gangrene_with_associations_and_references(
    graph,
    gas_gangrene,
    penicillins,
    pomc_to_gas_gangrene_pathogenesis_edge,
    penicillins_to_gas_gangrene_alleviates_edge,
    penicillins_to_gas_gangrene_treatment_edge,
):
    tx = graph.begin()

    # Association Nodes
    pomc_to_gas_gangrene_association_node = Node(
        'Association',
        assoc_type='J',
        description='role in disease pathogenesis',
        id=1387448,
    )
    penicillins_to_gas_gangrene_association_node1 = Node(
        'Association',
        assoc_type='Pa',
        description='alleviates, reduces',
        id=2771500,
    )
    penicillins_to_gas_gangrene_association_node2 = Node(
        'Association',
        assoc_type='J',
        description='treatment/therapy (including investigatory)' ,
        id=2771501,
    )

    # Reference Nodes
    penicillins_to_gas_gangrene_reference_node1 = Node(
        'Reference',
        entry1_text='penicillin',
        entry2_text='gas gangrene',
        id=9810347,
        score=0.4300000071525574,
        sentence='In a mouse model of gas_gangrene caused by...',
    )
    penicillins_to_gas_gangrene_reference_node2 = Node(
        'Reference',
        entry1_text='penicillin',
        entry2_text='gas gangrene',
        id=9810346,
        score=0.4300000071525574,
        sentence='Toxin suppression and rapid bacterial killing may...',
    )

    # Entity -> Association Relationships
    pomc_to_association_edge = Relationship(
        pomc, 'HAS_ASSOCIATION', pomc_to_gas_gangrene_association_node,
    )

    penicillins_to_association_edge1 = Relationship(
        penicillins, 'HAS_ASSOCIATION', penicillins_to_gas_gangrene_association_node1,
    )

    penicillins_to_association_edge2 = Relationship(
        penicillins, 'HAS_ASSOCIATION', penicillins_to_gas_gangrene_association_node2,
    )

    tx.create(pomc_to_association_edge)
    tx.create(penicillins_to_association_edge1)
    tx.create(penicillins_to_association_edge2)

    # Association -> Entity Relationships
    pomc_association_to_gas_gangrene_edge = Relationship(
        pomc_to_gas_gangrene_association_node, 'HAS_ASSOCIATION', gas_gangrene,
    )

    penicillins_association_to_gas_gangrene_edge1 = Relationship(
        penicillins_to_gas_gangrene_association_node1, 'HAS_ASSOCIATION', gas_gangrene,
    )

    penicillins_association_to_gas_gangrene_edge2 = Relationship(
        penicillins_to_gas_gangrene_association_node2, 'HAS_ASSOCIATION', gas_gangrene,
    )

    tx.create(pomc_association_to_gas_gangrene_edge)
    tx.create(penicillins_association_to_gas_gangrene_edge1)
    tx.create(penicillins_association_to_gas_gangrene_edge2)

    # Association -> Reference Relationships
    penicillins_alleviates_reduces_association_to_reference_edge = Relationship(
        penicillins_to_gas_gangrene_association_node1, 'HAS_REF', penicillins_to_gas_gangrene_reference_node1
    )

    penicillins_treatment_association_to_reference_edge = Relationship(
        penicillins_to_gas_gangrene_association_node2, 'HAS_REF', penicillins_to_gas_gangrene_reference_node2
    )
    tx.create(penicillins_alleviates_reduces_association_to_reference_edge)
    tx.create(penicillins_treatment_association_to_reference_edge)

    tx.commit()

    return gas_gangrene
