import pytest

from neo4japp.data_transfer_objects.visualization import (
    ClusteredNode,
    DuplicateNodeEdgePair,
    DuplicateVisEdge,
    DuplicateVisNode,
    NodeEdgePair,
    VisEdge,
    VisNode,
)
from neo4japp.models.neo4j import (
    GraphNode,
    GraphRelationship,
)

@pytest.fixture(scope='function')
def client(app):
    """Creates a HTTP client for REST actions for a test."""
    client = app.test_client()

    return client


@pytest.fixture(scope='function')
def gas_gangrene_vis_node(gas_gangrene):
    """Creates a VisNode from gas gangrene"""
    node_as_graph_node = GraphNode.from_py2neo(gas_gangrene)

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
    node_as_graph_node = GraphNode.from_py2neo(gas_gangrene)

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
    node_as_graph_node = GraphNode.from_py2neo(penicillins)

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
    node_as_graph_node = GraphNode.from_py2neo(penicillins)

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
    node_as_graph_node = GraphNode.from_py2neo(pomc)

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
    node_as_graph_node = GraphNode.from_py2neo(pomc)

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
        label=edge_as_graph_relationship.label,
        data=edge_as_graph_relationship.data,
        to=edge_as_graph_relationship.to,
        from_=edge_as_graph_relationship._from,
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
        label=edge_as_graph_relationship.label,
        data=edge_as_graph_relationship.data,
        to=f'duplicateNode:{edge_as_graph_relationship.to}',
        from_=f'duplicateNode:{edge_as_graph_relationship._from}',
        arrows='to',
        duplicate_of=edge_as_graph_relationship.id,
        original_from=edge_as_graph_relationship.to,
        original_to=edge_as_graph_relationship._from,
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
        label=edge_as_graph_relationship.label,
        data=edge_as_graph_relationship.data,
        to=edge_as_graph_relationship.to,
        from_=edge_as_graph_relationship._from,
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
        label=edge_as_graph_relationship.label,
        data=edge_as_graph_relationship.data,
        to=f'duplicateNode:{edge_as_graph_relationship.to}',
        from_=f'duplicateNode:{edge_as_graph_relationship._from}',
        arrows='to',
        duplicate_of=edge_as_graph_relationship.id,
        original_from=edge_as_graph_relationship.to,
        original_to=edge_as_graph_relationship._from,
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