import pytest
import os

from py2neo import (
    Graph,
    Node,
    Relationship,
)

from neo4japp.constants import DISPLAY_NAME_MAP
from neo4japp.database import db, reset_dao
from neo4japp.data_transfer_objects.visualization import (
    ClusteredNode,
    DuplicateNodeEdgePair,
    DuplicateVisEdge,
    DuplicateVisNode,
    NodeEdgePair,
    VisEdge,
    VisNode,
)
from neo4japp.factory import create_app
from neo4japp.models.neo4j import (
    GraphNode,
    GraphRelationship,
)
from neo4japp.services import (
    AccountService,
    AuthService,
    GraphBaseDao,
    Neo4JService,
    SearchService,
)


@pytest.fixture(scope='function')
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
def session(app, request):
    """ Creates a new database session """
    connection = db.engine.connect()
    transaction = connection.begin()
    options = dict(bind=connection, binds={})
    session = db.create_scoped_session(options=options)
    db.session = session

    def teardown():
        transaction.rollback()
        connection.close()
        session.remove()
        reset_dao()

    request.addfinalizer(teardown)
    return session


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
def graph(request, app):
    """Returns a graph connection to the Neo4J database.
    IMPORTANT: Tests may not behave as expected if the
    Neo4J database is not cleared before running tests!
    """
    graph = Graph(
        host=os.environ.get('NEO4J_HOST'),
        auth=os.environ.get('NEO4J_AUTH').split('/')
    )

    # Ensure a clean graph state before every test
    graph.run("MATCH(n) DETACH DELETE n")

    return graph

# Begin DAO Fixtures #
@pytest.fixture(scope='function')
def base_dao(graph):
    """For testing methods in GraphBaseDao"""
    return GraphBaseDao(graph)


@pytest.fixture(scope='function')
def neo4j_service_dao(graph):
    """Neo4JService using the test graph"""
    return Neo4JService(graph)


@pytest.fixture(scope='function')
def search_service_dao(graph):
    """SearchService using the test graph"""
    return SearchService(graph)

# End DAO Fixtures #

# Begin Graph Data Fixtures #

# Begin Entity Node Fixtures #
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

# End Entity Nodes Fixtures #

# Begin Entity -> Entity Relationship Fixtures #

# NOTE: These must use Cypher directly, not the `create`
# py2neo method. This is a py2neo limitiation:
# https://github.com/technige/py2neo/issues/573
# If we don't use Cypher, we can't create multiple
# edges between two nodes.


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
        pomc, 'ASSOCIATED', gas_gangrene, assoc_type='J', description='role in disease pathogenesis',  # noqa
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
        penicillins, 'ASSOCIATED', gas_gangrene, assoc_type='Pa', description='alleviates, reduces',
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
        penicillins, 'ASSOCIATED', gas_gangrene, assoc_type='J', description='treatment/therapy (including investigatory)',  # noqa
    )

    tx.create(penicillins_to_gas_gangrene_treatment_edge)
    tx.commit()

    return penicillins_to_gas_gangrene_treatment_edge

# End Entity -> Entity Relationship Fixtures #

# Start Misc. Fixtures #
@pytest.fixture(scope='function')
def gas_gangrene_with_associations_and_references(
    graph,
    gas_gangrene,
    penicillins,
    pomc,
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
        description='treatment/therapy (including investigatory)',
        id=2771501,
    )

    # Snippet Nodes
    penicillins_to_gas_gangrene_snippet_node1 = Node(
        'Snippet',
        entry1_text='penicillin',
        entry2_text='gas gangrene',
        id=9810347,
        sentence='In a mouse model of gas_gangrene caused by...',
    )
    penicillins_to_gas_gangrene_snippet_node2 = Node(
        'Snippet',
        entry1_text='penicillin',
        entry2_text='gas gangrene',
        id=9810346,
        sentence='Toxin suppression and rapid bacterial killing may...',
    )

    # Publication Nodes
    penicillins_to_gas_gangrene_publication_node1 = Node(
        'Publication',
        id=1,
    )
    penicillins_to_gas_gangrene_publication_node2 = Node(
        'Publication',
        id=2,
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

    # Association <- Snippet Relationships
    penicillins_alleviates_reduces_association_to_snippet_edge = Relationship(
        penicillins_to_gas_gangrene_snippet_node1, 'PREDICTS', penicillins_to_gas_gangrene_association_node1  # noqa
    )

    penicillins_treatment_association_to_snippet_edge = Relationship(
        penicillins_to_gas_gangrene_snippet_node2, 'PREDICTS', penicillins_to_gas_gangrene_association_node2,   # noqa
    )
    tx.create(penicillins_alleviates_reduces_association_to_snippet_edge)
    tx.create(penicillins_treatment_association_to_snippet_edge)

    # Snippet -> Publication Relationships
    penicillins_alleviates_reduces_snippet_to_publication_edge = Relationship(
        penicillins_to_gas_gangrene_snippet_node1, 'HAS_PUBLICATION', penicillins_to_gas_gangrene_publication_node1  # noqa
    )

    penicillins_treatment_snippet_to_publication_edge = Relationship(
        penicillins_to_gas_gangrene_snippet_node2, 'HAS_PUBLICATION', penicillins_to_gas_gangrene_publication_node2  # noqa
    )
    tx.create(penicillins_alleviates_reduces_snippet_to_publication_edge)
    tx.create(penicillins_treatment_snippet_to_publication_edge)

    tx.commit()

    return gas_gangrene

# End Graph Data Fixtures #

# Start DTO Fixtures #


@pytest.fixture(scope='function')
def gas_gangrene_vis_node(gas_gangrene):
    """Creates a VisNode from gas gangrene"""
    node_as_graph_node = GraphNode.from_py2neo(
        gas_gangrene,
        display_fn=lambda x: x.get(DISPLAY_NAME_MAP[next(iter(gas_gangrene.labels), set())])
    )

    gas_gangrene_vis_node = VisNode(
        id=node_as_graph_node.id,
        label=node_as_graph_node.label,
        data=node_as_graph_node.data,
        sub_labels=node_as_graph_node.sub_labels,
        display_name=node_as_graph_node.display_name,
        primary_label=node_as_graph_node.sub_labels[0],
        color=dict(),
        expanded=False,
    )

    return gas_gangrene_vis_node


@pytest.fixture(scope='function')
def gas_gangrene_duplicate_vis_node(gas_gangrene):
    """Creates a DuplicateVisNode from gas gangrene"""
    node_as_graph_node = GraphNode.from_py2neo(
        gas_gangrene,
        display_fn=lambda x: x.get(DISPLAY_NAME_MAP[next(iter(gas_gangrene.labels), set())])
    )

    gas_gangrene_duplicate_vis_node = DuplicateVisNode(
        id=f'duplicateNode:{node_as_graph_node.id}',
        label=node_as_graph_node.label,
        data=node_as_graph_node.data,
        sub_labels=node_as_graph_node.sub_labels,
        display_name=node_as_graph_node.display_name,
        primary_label=node_as_graph_node.sub_labels[0],
        color=dict(),
        expanded=False,
        duplicate_of=node_as_graph_node.id
    )

    return gas_gangrene_duplicate_vis_node


@pytest.fixture(scope='function')
def penicillins_vis_node(penicillins):
    """Creates a VisNode from penicillins"""
    node_as_graph_node = GraphNode.from_py2neo(
        penicillins,
        display_fn=lambda x: x.get(DISPLAY_NAME_MAP[next(iter(penicillins.labels), set())])
    )

    penicillins_vis_node = VisNode(
        id=node_as_graph_node.id,
        label=node_as_graph_node.label,
        data=node_as_graph_node.data,
        sub_labels=node_as_graph_node.sub_labels,
        display_name=node_as_graph_node.display_name,
        primary_label=node_as_graph_node.sub_labels[0],
        color=dict(),
        expanded=False,
    )

    return penicillins_vis_node


@pytest.fixture(scope='function')
def penicillins_duplicate_vis_node(penicillins):
    """Creates a DuplicateVisNode from penicillins"""
    node_as_graph_node = GraphNode.from_py2neo(
        penicillins,
        display_fn=lambda x: x.get(DISPLAY_NAME_MAP[next(iter(penicillins.labels), set())])
    )

    penicillins_duplicate_vis_node = DuplicateVisNode(
        id=f'duplicateNode:{node_as_graph_node.id}',
        label=node_as_graph_node.label,
        data=node_as_graph_node.data,
        sub_labels=node_as_graph_node.sub_labels,
        display_name=node_as_graph_node.display_name,
        primary_label=node_as_graph_node.sub_labels[0],
        color=dict(),
        expanded=False,
        duplicate_of=node_as_graph_node.id
    )

    return penicillins_duplicate_vis_node


@pytest.fixture(scope='function')
def pomc_vis_node(pomc):
    """Creates a VisNode from pomc"""
    node_as_graph_node = GraphNode.from_py2neo(
        pomc,
        display_fn=lambda x: x.get(DISPLAY_NAME_MAP[next(iter(pomc.labels), set())])
    )

    pomc_vis_node = VisNode(
        id=node_as_graph_node.id,
        label=node_as_graph_node.label,
        data=node_as_graph_node.data,
        sub_labels=node_as_graph_node.sub_labels,
        display_name=node_as_graph_node.display_name,
        primary_label=node_as_graph_node.sub_labels[0],
        color=dict(),
        expanded=False,
    )

    return pomc_vis_node


@pytest.fixture(scope='function')
def pomc_duplicate_vis_node(pomc):
    """Creates a DuplicateVisNode from pomc"""
    node_as_graph_node = GraphNode.from_py2neo(
        pomc,
        display_fn=lambda x: x.get(DISPLAY_NAME_MAP[next(iter(pomc.labels), set())])
    )

    pomc_duplicate_vis_node = DuplicateVisNode(
        id=f'duplicateNode:{node_as_graph_node.id}',
        label=node_as_graph_node.label,
        data=node_as_graph_node.data,
        sub_labels=node_as_graph_node.sub_labels,
        display_name=node_as_graph_node.display_name,
        primary_label=node_as_graph_node.sub_labels[0],
        color=dict(),
        expanded=False,
        duplicate_of=node_as_graph_node.id
    )

    return pomc_duplicate_vis_node


@pytest.fixture(scope='function')
def pomc_to_gas_gangrene_pathogenesis_as_vis_edge(
    pomc_to_gas_gangrene_pathogenesis_edge,
):
    """Creates a VisEdge from the pomc to gas gangrene
    role in disease pathogenesis relationship."""
    edge_as_graph_relationship = GraphRelationship.from_py2neo(
        pomc_to_gas_gangrene_pathogenesis_edge,
    )

    pomc_to_gas_gangrene_pathogenesis_as_vis_edge = VisEdge(
        id=edge_as_graph_relationship.id,
        label=edge_as_graph_relationship.data['description'],
        data=edge_as_graph_relationship.data,
        to=edge_as_graph_relationship.to,
        from_=edge_as_graph_relationship._from,
        to_label='Disease',
        from_label='Gene',
        arrows='to',
    )

    return pomc_to_gas_gangrene_pathogenesis_as_vis_edge


@pytest.fixture(scope='function')
def pomc_to_gas_gangrene_pathogenesis_as_duplicate_vis_edge(
    pomc_to_gas_gangrene_pathogenesis_edge,
):
    """Creates a DuplicateVisEdge from the pomc to gas_gangrene
    role in disease pathogenesis relationship."""
    edge_as_graph_relationship = GraphRelationship.from_py2neo(
        pomc_to_gas_gangrene_pathogenesis_edge,
    )

    pomc_to_gas_gangrene_pathogenesis_as_duplicate_vis_edge = DuplicateVisEdge(
        id=edge_as_graph_relationship.id,
        label=edge_as_graph_relationship.data['description'],
        data=edge_as_graph_relationship.data,
        to=f'duplicateNode:{edge_as_graph_relationship.to}',
        from_=f'duplicateNode:{edge_as_graph_relationship._from}',
        to_label='Disease',
        from_label='Gene',
        arrows='to',
        duplicate_of=edge_as_graph_relationship.id,
        original_from=edge_as_graph_relationship._from,
        original_to=edge_as_graph_relationship.to,
    )

    return pomc_to_gas_gangrene_pathogenesis_as_duplicate_vis_edge


@pytest.fixture(scope='function')
def penicillins_to_gas_gangrene_alleviates_as_vis_edge(
    penicillins_to_gas_gangrene_alleviates_edge,
):
    """Creates a VisEdge from the penicillins to gas gangrene
    alleviates/reduces relationship."""
    edge_as_graph_relationship = GraphRelationship.from_py2neo(
        penicillins_to_gas_gangrene_alleviates_edge,
    )

    penicillins_to_gas_gangrene_alleviates_as_vis_edge = VisEdge(
        id=edge_as_graph_relationship.id,
        label=edge_as_graph_relationship.data['description'],
        data=edge_as_graph_relationship.data,
        to=edge_as_graph_relationship.to,
        from_=edge_as_graph_relationship._from,
        to_label='Disease',
        from_label='Chemical',
        arrows='to',
    )

    return penicillins_to_gas_gangrene_alleviates_as_vis_edge


@pytest.fixture(scope='function')
def penicillins_to_gas_gangrene_alleviates_as_duplicate_vis_edge(
    penicillins_to_gas_gangrene_alleviates_edge,
):
    """Creates a DuplicateVisEdge from the penicillins to gas_gangrene
    alleviates/reduces relationship."""
    edge_as_graph_relationship = GraphRelationship.from_py2neo(
        penicillins_to_gas_gangrene_alleviates_edge,
    )

    penicillins_to_gas_gangrene_alleviates_as_duplicate_vis_edge = DuplicateVisEdge(
        id=edge_as_graph_relationship.id,
        label=edge_as_graph_relationship.data['description'],
        data=edge_as_graph_relationship.data,
        to=f'duplicateNode:{edge_as_graph_relationship.to}',
        from_=f'duplicateNode:{edge_as_graph_relationship._from}',
        to_label='Disease',
        from_label='Chemical',
        arrows='to',
        duplicate_of=edge_as_graph_relationship.id,
        original_from=edge_as_graph_relationship._from,
        original_to=edge_as_graph_relationship.to,
    )

    return penicillins_to_gas_gangrene_alleviates_as_duplicate_vis_edge


@pytest.fixture(scope='function')
def penicillins_to_gas_gangrene_treatment_as_vis_edge(
    penicillins_to_gas_gangrene_treatment_edge,
):
    """Creates a VisEdge from the penicillins to gas_gangrene
    treatment/therapy relationship."""
    edge_as_graph_relationship = GraphRelationship.from_py2neo(
        penicillins_to_gas_gangrene_treatment_edge,
    )

    penicillins_to_gas_gangrene_treatment_as_vis_edge = VisEdge(
        id=edge_as_graph_relationship.id,
        label=edge_as_graph_relationship.data['description'],
        data=edge_as_graph_relationship.data,
        to=edge_as_graph_relationship.to,
        from_=edge_as_graph_relationship._from,
        to_label='Disease',
        from_label='Chemical',
        arrows='to',
    )

    return penicillins_to_gas_gangrene_treatment_as_vis_edge


@pytest.fixture(scope='function')
def penicillins_to_gas_gangrene_treatment_as_duplicate_vis_edge(
    penicillins_to_gas_gangrene_treatment_edge,
):
    """Creates a DuplicateVisEdge from the penicillins to gas_gangrene
    treatment/therapy relationship."""
    edge_as_graph_relationship = GraphRelationship.from_py2neo(
        penicillins_to_gas_gangrene_treatment_edge,
    )

    penicillins_to_gas_gangrene_treatment_as_duplicate_vis_edge = DuplicateVisEdge(
        id=f'duplicateEdge:{edge_as_graph_relationship.id}',
        label=edge_as_graph_relationship.data['description'],
        data=edge_as_graph_relationship.data,
        to=f'duplicateNode:{edge_as_graph_relationship.to}',
        from_=f'duplicateNode:{edge_as_graph_relationship._from}',
        to_label='Disease',
        from_label='Chemical',
        arrows='to',
        duplicate_of=edge_as_graph_relationship.id,
        original_from=edge_as_graph_relationship._from,
        original_to=edge_as_graph_relationship.to,
    )

    return penicillins_to_gas_gangrene_treatment_as_duplicate_vis_edge


@pytest.fixture(scope='function')
def gas_gangrene_treatment_cluster_node_edge_pairs(
    penicillins_duplicate_vis_node,
    penicillins_to_gas_gangrene_treatment_as_duplicate_vis_edge
):
    """Creates a list of DuplicateNodeEdgePairs. Used for testing the
    reference table endpoints and services."""
    return [
        DuplicateNodeEdgePair(
            node=penicillins_duplicate_vis_node,
            edge=penicillins_to_gas_gangrene_treatment_as_duplicate_vis_edge,
        )
    ]


@pytest.fixture(scope='function')
def gas_gangrene_treatment_clustered_nodes(
    penicillins_duplicate_vis_node,
    penicillins_to_gas_gangrene_treatment_as_duplicate_vis_edge,
):
    """Returns a list of ClusteredNode objects. Used for testing the
    cluster graph data endpoints and services."""
    return [
        ClusteredNode(
            node_id=penicillins_duplicate_vis_node.id,
            edges=[penicillins_to_gas_gangrene_treatment_as_duplicate_vis_edge],
        )
    ]

# End DTO Fixtures #
