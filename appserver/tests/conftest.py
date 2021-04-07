import pytest
import os
from pathlib import Path
from elasticsearch import Elasticsearch
from py2neo import (
    Graph,
    Node,
    Relationship,
)

from neo4japp.services.common import GraphBaseDao
from neo4japp.constants import DISPLAY_NAME_MAP
from neo4japp.database import db, reset_dao
from neo4japp.data_transfer_objects.visualization import (
    DuplicateEdgeConnectionData,
    DuplicateVisEdge,
    DuplicateVisNode,
    EdgeConnectionData,
    ReferenceTablePair,
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
    KgService,
    SearchService,
    VisualizerService,
)
from neo4japp.services.elastic import ElasticService
from neo4japp.util import (
    get_first_known_label_from_node,
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


@pytest.fixture(scope='function')
def graph(request, app):
    """Returns a graph connection to the Neo4J database.
    IMPORTANT: Tests may not behave as expected if the
    Neo4J database is not cleared before running tests!
    """
    graph = Graph(
        host=os.environ.get('NEO4J_HOST'),
        auth=os.environ.get('NEO4J_AUTH').split('/'),
        port=os.environ.get('NEO4J_PORT'),
        scheme=os.environ.get('NEO4J_SCHEME')
    )

    # Ensure a clean graph state before every test
    graph.run("MATCH(n) DETACH DELETE n")

    return graph


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
def kg_service(graph, session):
    return KgService(
        graph=graph,
        session=session
    )


@pytest.fixture(scope='function')
def visualizer_service(app, graph, session):
    return VisualizerService(
        graph=graph,
        session=session
    )


@pytest.fixture(scope='function')
def elastic_service(app, session):
    elastic_conn = Elasticsearch(
        timeout=180,
        hosts=[os.environ.get('ELASTICSEARCH_HOSTS')]
    )
    elastic_service = ElasticService(elastic=elastic_conn)

    # Ensures that anytime the elastic service is requested for a test, that the environment is
    # clean
    elastic_service.recreate_indices_and_pipelines()

    return elastic_service

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
def oxygen(graph):
    """Creates a chemical node and adds it to the graph."""
    tx = graph.begin()

    oxygen = Node('Chemical', name='Oxygen', id='MESH:D010100')

    tx.create(oxygen)
    tx.commit()

    return oxygen


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
def oxygen_to_gas_gangrene_treatment_edge(
    graph,
    gas_gangrene,
    oxygen,
):
    """Creates an ASSOCIATED relationship from oxygen to gas
    gangrene and adds it to the graph."""

    tx = graph.begin()

    oxygen_to_gas_gangrene_treatment_edge = Relationship(
        oxygen, 'ASSOCIATED', gas_gangrene, assoc_type='Pa', description='treatment/therapy (including investigatory)',  # noqa
    )

    tx.create(oxygen_to_gas_gangrene_treatment_edge)
    tx.commit()

    return oxygen_to_gas_gangrene_treatment_edge


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
    oxygen,
    oxygen_to_gas_gangrene_treatment_edge,
    penicillins,
    pomc,
    pomc_to_gas_gangrene_pathogenesis_edge,
    penicillins_to_gas_gangrene_alleviates_edge,
    penicillins_to_gas_gangrene_treatment_edge,
):
    tx = graph.begin()

    # Association Nodes
    oxygen_to_gas_gangrene_association_node = Node(
        'Association',
        assoc_type='J',
        description='treatment/therapy (including investigatory)',
        id=1089126,
    )
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
    oxygen_to_gas_gangrene_snippet_node1 = Node(
        'Snippet',
        entry1_text='oxygen',
        entry2_text='gas gangrene',
        id=7430189,
        sentence='In this study , we aimed to investigate the effect of HBO2...',
    )
    oxygen_to_gas_gangrene_snippet_node2 = Node(
        'Snippet',
        entry1_text='oxygen',
        entry2_text='gas gangrene',
        id=1890743,
        sentence='Hyperbaric oxygen therapy has an adjunctive role...',
    )
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
    penicillins_to_gas_gangrene_snippet_node3 = Node(
        'Snippet',
        entry1_text='penicillin',
        entry2_text='gas gangrene',
        id=9810348,
        sentence='...penicillin was found to reduce the affect of...',
    )
    penicillins_to_gas_gangrene_snippet_node4 = Node(
        'Snippet',
        entry1_text='penicillin',
        entry2_text='gas gangrene',
        id=9810346,
        sentence='...suppresses toxins and rapidly kills bacteria...',
    )

    # Publication Nodes
    oxygen_to_gas_gangrene_publication_node = Node(
        'Publication',
        id=3,
        pub_year=2019,
    )
    penicillins_to_gas_gangrene_publication_node1 = Node(
        'Publication',
        id=1,
        pub_year=2014
    )
    penicillins_to_gas_gangrene_publication_node2 = Node(
        'Publication',
        id=2,
    )

    # Entity -> Association Relationships
    oxygen_to_association_edge = Relationship(
        oxygen, 'HAS_ASSOCIATION', oxygen_to_gas_gangrene_association_node,
    )
    pomc_to_association_edge = Relationship(
        pomc, 'HAS_ASSOCIATION', pomc_to_gas_gangrene_association_node,
    )

    penicillins_to_association_edge1 = Relationship(
        penicillins, 'HAS_ASSOCIATION', penicillins_to_gas_gangrene_association_node1,
    )

    penicillins_to_association_edge2 = Relationship(
        penicillins, 'HAS_ASSOCIATION', penicillins_to_gas_gangrene_association_node2,
    )

    tx.create(oxygen_to_association_edge)
    tx.create(pomc_to_association_edge)
    tx.create(penicillins_to_association_edge1)
    tx.create(penicillins_to_association_edge2)

    # Association -> Entity Relationships
    oxygen_association_to_gas_gangrene_edge = Relationship(
        oxygen_to_gas_gangrene_association_node, 'HAS_ASSOCIATION', gas_gangrene,
    )
    pomc_association_to_gas_gangrene_edge = Relationship(
        pomc_to_gas_gangrene_association_node, 'HAS_ASSOCIATION', gas_gangrene,
    )

    penicillins_association_to_gas_gangrene_edge1 = Relationship(
        penicillins_to_gas_gangrene_association_node1, 'HAS_ASSOCIATION', gas_gangrene,
    )

    penicillins_association_to_gas_gangrene_edge2 = Relationship(
        penicillins_to_gas_gangrene_association_node2, 'HAS_ASSOCIATION', gas_gangrene,
    )

    tx.create(oxygen_association_to_gas_gangrene_edge)
    tx.create(pomc_association_to_gas_gangrene_edge)
    tx.create(penicillins_association_to_gas_gangrene_edge1)
    tx.create(penicillins_association_to_gas_gangrene_edge2)

    # Association <- Snippet Relationships
    oxygen_treatment_association_to_snippet_edge1 = Relationship(
        oxygen_to_gas_gangrene_snippet_node1, 'PREDICTS', oxygen_to_gas_gangrene_association_node,
    )
    oxygen_treatment_association_to_snippet_edge2 = Relationship(
        oxygen_to_gas_gangrene_snippet_node2, 'PREDICTS', oxygen_to_gas_gangrene_association_node,
    )
    penicillins_alleviates_reduces_association_to_snippet_edge = Relationship(
        penicillins_to_gas_gangrene_snippet_node1, 'PREDICTS', penicillins_to_gas_gangrene_association_node1,  # noqa
        raw_score=2, normalized_score=0.385
    )

    penicillins_alleviates_reduces_association_to_snippet_edge2 = Relationship(
        penicillins_to_gas_gangrene_snippet_node3, 'PREDICTS', penicillins_to_gas_gangrene_association_node1,  # noqa
        raw_score=5, normalized_score=0.693
    )

    penicillins_treatment_association_to_snippet_edge = Relationship(
        penicillins_to_gas_gangrene_snippet_node2, 'PREDICTS', penicillins_to_gas_gangrene_association_node2,   # noqa
        raw_score=1, normalized_score=0.222
    )

    penicillins_treatment_association_to_snippet_edge2 = Relationship(
        penicillins_to_gas_gangrene_snippet_node4, 'PREDICTS', penicillins_to_gas_gangrene_association_node2,   # noqa
        raw_score=3, normalized_score=0.456
    )

    tx.create(oxygen_treatment_association_to_snippet_edge1)
    tx.create(oxygen_treatment_association_to_snippet_edge2)
    tx.create(penicillins_alleviates_reduces_association_to_snippet_edge)
    tx.create(penicillins_alleviates_reduces_association_to_snippet_edge2)
    tx.create(penicillins_treatment_association_to_snippet_edge)
    tx.create(penicillins_treatment_association_to_snippet_edge2)

    # Snippet -> Publication Relationships
    oxygen_treatment_snippet_to_publication_edge1 = Relationship(
        oxygen_to_gas_gangrene_snippet_node1, 'IN_PUB', oxygen_to_gas_gangrene_publication_node
    )
    oxygen_treatment_snippet_to_publication_edge2 = Relationship(
        oxygen_to_gas_gangrene_snippet_node2, 'IN_PUB', oxygen_to_gas_gangrene_publication_node
    )
    penicillins_alleviates_reduces_snippet_to_publication_edge = Relationship(
        penicillins_to_gas_gangrene_snippet_node1, 'IN_PUB', penicillins_to_gas_gangrene_publication_node1  # noqa
    )

    penicillins_alleviates_reduces_snippet_to_publication_edge2 = Relationship(
        penicillins_to_gas_gangrene_snippet_node3, 'IN_PUB', penicillins_to_gas_gangrene_publication_node2  # noqa
    )

    penicillins_treatment_snippet_to_publication_edge = Relationship(
        penicillins_to_gas_gangrene_snippet_node2, 'IN_PUB', penicillins_to_gas_gangrene_publication_node2  # noqa
    )

    penicillins_treatment_snippet_to_publication_edge2 = Relationship(
        penicillins_to_gas_gangrene_snippet_node4, 'IN_PUB', penicillins_to_gas_gangrene_publication_node2  # noqa
    )

    tx.create(oxygen_treatment_snippet_to_publication_edge1)
    tx.create(oxygen_treatment_snippet_to_publication_edge2)
    tx.create(penicillins_alleviates_reduces_snippet_to_publication_edge)
    tx.create(penicillins_alleviates_reduces_snippet_to_publication_edge2)
    tx.create(penicillins_treatment_snippet_to_publication_edge)
    tx.create(penicillins_treatment_snippet_to_publication_edge2)

    tx.commit()

    return gas_gangrene


@pytest.fixture(scope='function')
def example4_pdf_gene_and_organism_network(
    graph,
):
    tx = graph.begin()

    cysB = Node(
        'Gene',
        name='cysB',
        locus_tag='b1275',
        id='945771'
    )

    mcrB = Node(
        'Gene',
        name='mcrB',
        locus_tag='b4346',
        id='949122'
    )

    oxyR_e_coli = Node(
        'Gene',
        name='oxyR',
        locus_tag='b3961',
        id='948462'
    )

    oxyR_salmonella = Node(
        'Gene',
        name='cysB',
        locus_tag='STM4125',
        id='1255651'
    )

    e_coli = Node(
        'Taxonomy',
        name='Escherichia coli',
        rank='species',
        id='562',
    )

    salmonella = Node(
        'Taxonomy',
        name='Salmonella enterica',
        rank='species',
        id='28901',
    )

    cysB_has_taxonomy_e_coli = Relationship(
        cysB, 'HAS_TAXONOMY', e_coli,
    )

    mcrB_has_taxonomy_e_coli = Relationship(
        mcrB, 'HAS_TAXONOMY', e_coli,
    )

    oxyR_has_taxonomy_e_coli = Relationship(
        oxyR_e_coli, 'HAS_TAXONOMY', e_coli,
    )

    oxyR_has_taxonomy_salmonella = Relationship(
        oxyR_salmonella, 'HAS_TAXONOMY', salmonella,
    )

    tx.create(cysB_has_taxonomy_e_coli)
    tx.create(mcrB_has_taxonomy_e_coli)
    tx.create(oxyR_has_taxonomy_e_coli)
    tx.create(oxyR_has_taxonomy_salmonella)

    tx.commit()

    return graph


@pytest.fixture(scope='function')
def human_gene_pdf_gene_and_organism_network(
    graph,
):
    tx = graph.begin()

    ace2 = Node(
        'Gene',
        name='ace2',
        id='59272'
    )

    human = Node(
        'Taxonomy',
        name='Homo Sapiens',
        rank='species',
        id='9606',
    )

    ace2_has_taxonomy_homo_sapiens = Relationship(
        ace2, 'HAS_TAXONOMY', human,
    )

    tx.create(ace2_has_taxonomy_homo_sapiens)

    tx.commit()

    return graph

# End Graph Data Fixtures #

# Start DTO Fixtures #


@pytest.fixture(scope='function')
def gas_gangrene_vis_node(gas_gangrene):
    """Creates a VisNode from gas gangrene"""
    node_as_graph_node = GraphNode.from_py2neo(
        gas_gangrene,
        # TODO: Should change the way label is retrieved here...
        display_fn=lambda x: x.get(DISPLAY_NAME_MAP[get_first_known_label_from_node(gas_gangrene)])
    )

    gas_gangrene_vis_node = VisNode(
        id=node_as_graph_node.id,
        label=node_as_graph_node.label,
        data=node_as_graph_node.data,
        sub_labels=node_as_graph_node.sub_labels,
        display_name=node_as_graph_node.display_name,
        primary_label=node_as_graph_node.sub_labels[0],
        color={},
        expanded=False,
    )

    return gas_gangrene_vis_node


@pytest.fixture(scope='function')
def gas_gangrene_duplicate_vis_node(gas_gangrene):
    """Creates a DuplicateVisNode from gas gangrene"""
    node_as_graph_node = GraphNode.from_py2neo(
        gas_gangrene,
        display_fn=lambda x: x.get(DISPLAY_NAME_MAP[get_first_known_label_from_node(gas_gangrene)])
    )

    gas_gangrene_duplicate_vis_node = DuplicateVisNode(
        id=f'duplicateNode:{node_as_graph_node.id}',
        label=node_as_graph_node.label,
        data=node_as_graph_node.data,
        sub_labels=node_as_graph_node.sub_labels,
        display_name=node_as_graph_node.display_name,
        primary_label=node_as_graph_node.sub_labels[0],
        color={},
        expanded=False,
        duplicate_of=node_as_graph_node.id
    )

    return gas_gangrene_duplicate_vis_node


@pytest.fixture(scope='function')
def oxygen_duplicate_vis_node(oxygen):
    """Creates a DuplicateVisNode from oxygen"""
    node_as_graph_node = GraphNode.from_py2neo(
        oxygen,
        display_fn=lambda x: x.get(DISPLAY_NAME_MAP[get_first_known_label_from_node(oxygen)])
    )

    oxygen_duplicate_vis_node = DuplicateVisNode(
        id=f'duplicateNode:{node_as_graph_node.id}',
        label=node_as_graph_node.label,
        data=node_as_graph_node.data,
        sub_labels=node_as_graph_node.sub_labels,
        display_name=node_as_graph_node.display_name,
        primary_label=node_as_graph_node.sub_labels[0],
        color={},
        expanded=False,
        duplicate_of=node_as_graph_node.id
    )

    return oxygen_duplicate_vis_node


@pytest.fixture(scope='function')
def penicillins_vis_node(penicillins):
    """Creates a VisNode from penicillins"""
    node_as_graph_node = GraphNode.from_py2neo(
        penicillins,
        display_fn=lambda x: x.get(DISPLAY_NAME_MAP[get_first_known_label_from_node(penicillins)])
    )

    penicillins_vis_node = VisNode(
        id=node_as_graph_node.id,
        label=node_as_graph_node.label,
        data=node_as_graph_node.data,
        sub_labels=node_as_graph_node.sub_labels,
        display_name=node_as_graph_node.display_name,
        primary_label=node_as_graph_node.sub_labels[0],
        color={},
        expanded=False,
    )

    return penicillins_vis_node


@pytest.fixture(scope='function')
def penicillins_duplicate_vis_node(penicillins):
    """Creates a DuplicateVisNode from penicillins"""
    node_as_graph_node = GraphNode.from_py2neo(
        penicillins,
        display_fn=lambda x: x.get(DISPLAY_NAME_MAP[get_first_known_label_from_node(penicillins)])
    )

    penicillins_duplicate_vis_node = DuplicateVisNode(
        id=f'duplicateNode:{node_as_graph_node.id}',
        label=node_as_graph_node.label,
        data=node_as_graph_node.data,
        sub_labels=node_as_graph_node.sub_labels,
        display_name=node_as_graph_node.display_name,
        primary_label=node_as_graph_node.sub_labels[0],
        color={},
        expanded=False,
        duplicate_of=node_as_graph_node.id
    )

    return penicillins_duplicate_vis_node


@pytest.fixture(scope='function')
def pomc_vis_node(pomc):
    """Creates a VisNode from pomc"""
    node_as_graph_node = GraphNode.from_py2neo(
        pomc,
        display_fn=lambda x: x.get(DISPLAY_NAME_MAP[get_first_known_label_from_node(pomc)])
    )

    pomc_vis_node = VisNode(
        id=node_as_graph_node.id,
        label=node_as_graph_node.label,
        data=node_as_graph_node.data,
        sub_labels=node_as_graph_node.sub_labels,
        display_name=node_as_graph_node.display_name,
        primary_label=node_as_graph_node.sub_labels[0],
        color={},
        expanded=False,
    )

    return pomc_vis_node


@pytest.fixture(scope='function')
def pomc_duplicate_vis_node(pomc):
    """Creates a DuplicateVisNode from pomc"""
    node_as_graph_node = GraphNode.from_py2neo(
        pomc,
        display_fn=lambda x: x.get(DISPLAY_NAME_MAP[get_first_known_label_from_node(pomc)])
    )

    pomc_duplicate_vis_node = DuplicateVisNode(
        id=f'duplicateNode:{node_as_graph_node.id}',
        label=node_as_graph_node.label,
        data=node_as_graph_node.data,
        sub_labels=node_as_graph_node.sub_labels,
        display_name=node_as_graph_node.display_name,
        primary_label=node_as_graph_node.sub_labels[0],
        color={},
        expanded=False,
        duplicate_of=node_as_graph_node.id
    )

    return pomc_duplicate_vis_node


@pytest.fixture(scope='function')
def oxygen_to_gas_gangrene_treatment_as_duplicate_vis_edge(
    oxygen_to_gas_gangrene_treatment_edge,
):
    """Creates a DuplicateVisEdge from the oxygen to gas_gangrene
    alleviates/reduces relationship."""
    edge_as_graph_relationship = GraphRelationship.from_py2neo(
        oxygen_to_gas_gangrene_treatment_edge,
    )

    oxygen_to_gas_gangrene_treatment_as_duplicate_vis_edge = DuplicateVisEdge(
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

    return oxygen_to_gas_gangrene_treatment_as_duplicate_vis_edge


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
    oxygen_duplicate_vis_node,
    oxygen_to_gas_gangrene_treatment_as_duplicate_vis_edge,
    penicillins_duplicate_vis_node,
    penicillins_to_gas_gangrene_treatment_as_duplicate_vis_edge
):
    """Creates a list of DuplicateNodeEdgePairs. Used for testing the
    reference table endpoints and services."""
    return [
        ReferenceTablePair(
            node=ReferenceTablePair.NodeData(
                id=oxygen_duplicate_vis_node.id,
                display_name=oxygen_duplicate_vis_node.display_name,
                label=oxygen_duplicate_vis_node.primary_label
            ),
            edge=ReferenceTablePair.EdgeData(
                original_from=oxygen_to_gas_gangrene_treatment_as_duplicate_vis_edge.original_from,  # noqa
                original_to=oxygen_to_gas_gangrene_treatment_as_duplicate_vis_edge.original_to,
                label=oxygen_to_gas_gangrene_treatment_as_duplicate_vis_edge.label,
            ),
        ),
        ReferenceTablePair(
            node=ReferenceTablePair.NodeData(
                id=penicillins_duplicate_vis_node.id,
                display_name=penicillins_duplicate_vis_node.display_name,
                label=penicillins_duplicate_vis_node.primary_label
            ),
            edge=ReferenceTablePair.EdgeData(
                original_from=penicillins_to_gas_gangrene_treatment_as_duplicate_vis_edge.original_from,  # noqa
                original_to=penicillins_to_gas_gangrene_treatment_as_duplicate_vis_edge.original_to,
                label=penicillins_to_gas_gangrene_treatment_as_duplicate_vis_edge.label,
            ),
        )
    ]


@pytest.fixture(scope='function')
def gas_gangrene_treatement_edge_data(
    penicillins_to_gas_gangrene_treatment_edge
):
    edge_as_graph_relationship = GraphRelationship.from_py2neo(
        penicillins_to_gas_gangrene_treatment_edge,
    )

    return EdgeConnectionData(
        label=edge_as_graph_relationship.data['description'],
        to=edge_as_graph_relationship.to,
        from_=edge_as_graph_relationship._from,
        to_label='Disease',
        from_label='Chemical',
    )


@pytest.fixture(scope='function')
def gas_gangrene_alleviates_edge_data(
    penicillins_to_gas_gangrene_alleviates_edge
):
    edge_as_graph_relationship = GraphRelationship.from_py2neo(
        penicillins_to_gas_gangrene_alleviates_edge,
    )

    return EdgeConnectionData(
        label=edge_as_graph_relationship.data['description'],
        to=edge_as_graph_relationship.to,
        from_=edge_as_graph_relationship._from,
        to_label='Disease',
        from_label='Chemical',
    )


@pytest.fixture(scope='function')
def gas_gangrene_treatement_duplicate_edge_data(
    penicillins_to_gas_gangrene_treatment_edge
):
    edge_as_graph_relationship = GraphRelationship.from_py2neo(
        penicillins_to_gas_gangrene_treatment_edge,
    )

    return [
            DuplicateEdgeConnectionData(
                label=edge_as_graph_relationship.data['description'],
                to=f'duplicateNode:{edge_as_graph_relationship.to}',
                from_=f'duplicateNode:{edge_as_graph_relationship._from}',
                to_label='Disease',
                from_label='Chemical',
                original_from=edge_as_graph_relationship._from,
                original_to=edge_as_graph_relationship.to,
            )
    ]


@pytest.fixture(scope='function')
def gas_gangrene_alleviates_duplicate_edge_data(
    penicillins_to_gas_gangrene_alleviates_edge
):
    edge_as_graph_relationship = GraphRelationship.from_py2neo(
        penicillins_to_gas_gangrene_alleviates_edge,
    )

    return [
            DuplicateEdgeConnectionData(
                label=edge_as_graph_relationship.data['description'],
                to=f'duplicateNode:{edge_as_graph_relationship.to}',
                from_=f'duplicateNode:{edge_as_graph_relationship._from}',
                to_label='Disease',
                from_label='Chemical',
                original_from=edge_as_graph_relationship._from,
                original_to=edge_as_graph_relationship.to,
            )
    ]

# End DTO Fixtures #


@pytest.fixture(scope='session')
def pdf_dir() -> str:
    """ Returns the directory of the example PDFs """
    return os.path.join(Path(__file__).parent, 'database', 'services', 'annotations', 'pdf_samples')
