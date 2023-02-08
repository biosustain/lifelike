from arango.database import StandardDatabase
from arango.collection import EdgeCollection
import pytest

from neo4japp.constants import DISPLAY_NAME_MAP
from neo4japp.data_transfer_objects.visualization import (
    DuplicateEdgeConnectionData,
    DuplicateVisEdge,
    DuplicateVisNode,
    EdgeConnectionData,
    ReferenceTablePair,
)
from neo4japp.models.neo4j import GraphNode, GraphRelationship
from neo4japp.services.arangodb import add_document_to_collection
from neo4japp.util import snake_to_camel_dict
from neo4japp.utils.labels import get_first_known_label_from_list


def _create_document(arango_db: StandardDatabase, colxn_name: str, **kwargs) -> dict:
    return add_document_to_collection(
            db=arango_db,
            colxn_name=colxn_name,
            doc=kwargs
        )


def _create_relationship_document(
    edge_collection: EdgeCollection,
    **kwargs
):
    return edge_collection.insert(
        kwargs,
        return_new=True
    )['new']


@pytest.fixture(scope='function')
def gas_gangrene(test_arango_db):
    gas_gangrene = _create_document(
        test_arango_db,
        'mesh',
        name='gas gangrene',
        eid='MESH:D005738',
        labels=['Disease']
    )
    return gas_gangrene


@pytest.fixture(scope='function')
def penicillins(test_arango_db):
    penicillins = _create_document(
        test_arango_db,
        'mesh',
        name='Penicillins',
        eid='MESH:D010406',
        labels=['Chemical']
    )
    return penicillins


@pytest.fixture(scope='function')
def oxygen(test_arango_db):
    oxygen = _create_document(
        test_arango_db,
        'mesh',
        name='Oxygen',
        eid='MESH:D010100',
        labels=['Chemical']
    )
    return oxygen


@pytest.fixture(scope='function')
def pomc(test_arango_db):
    pomc = _create_document(test_arango_db, 'ncbi', name='POMC', eid='5443', labels=['Gene'])
    return pomc


@pytest.fixture(scope='function')
def oxygen_to_gas_gangrene_association(test_arango_db):
    return _create_document(
        test_arango_db,
        'literature',
        assoc_type='J',
        description='treatment/therapy (including investigatory)',
        eid=1089126,
    )


@pytest.fixture(scope='function')
def pomc_to_gas_gangrene_association(test_arango_db):
    return _create_document(
        test_arango_db,
        'literature',
        assoc_type='J',
        description='role in disease pathogenesis',
        eid=1387448,
    )


@pytest.fixture(scope='function')
def penicillins_to_gas_gangrene_association_1(test_arango_db):
    return _create_document(
        test_arango_db,
        'literature',
        assoc_type='Pa',
        description='alleviates, reduces',
        eid=2771500,
    )


@pytest.fixture(scope='function')
def penicillins_to_gas_gangrene_association_2(test_arango_db):
    return _create_document(
        test_arango_db,
        'literature',
        assoc_type='J',
        description='treatment/therapy (including investigatory)',
        eid=2771501,
    )


@pytest.fixture(scope='function')
def pomc_to_gas_gangrene_pathogenesis_edge(
    associated_edge_collection: EdgeCollection,
    gas_gangrene: dict,
    pomc: dict,
    pomc_to_gas_gangrene_association: dict
):
    return _create_relationship_document(
        associated_edge_collection,
        _from=pomc['_id'],
        _to=gas_gangrene['_id'],
        assoc_type='J',
        description='role in disease pathogenesis',
        association_id=pomc_to_gas_gangrene_association['_id']
    )


@pytest.fixture(scope='function')
def penicillins_to_gas_gangrene_alleviates_edge(
    associated_edge_collection: EdgeCollection,
    gas_gangrene: dict,
    penicillins: dict,
    penicillins_to_gas_gangrene_association_1: dict,
):
    return _create_relationship_document(
        associated_edge_collection,
        _from=penicillins['_id'],
        _to=gas_gangrene['_id'],
        assoc_type='Pa',
        description='alleviates, reduces',
        association_id=penicillins_to_gas_gangrene_association_1['_id']
    )


@pytest.fixture(scope='function')
def oxygen_to_gas_gangrene_treatment_edge(
    associated_edge_collection: EdgeCollection,
    gas_gangrene: dict,
    oxygen: dict,
    oxygen_to_gas_gangrene_association: dict
):
    return _create_relationship_document(
        associated_edge_collection,
        _from=oxygen['_id'],
        _to=gas_gangrene['_id'],
        assoc_type='Pa',
        description='treatment/therapy (including investigatory)',
        association_id=oxygen_to_gas_gangrene_association['_id']
    )


@pytest.fixture(scope='function')
def penicillins_to_gas_gangrene_treatment_edge(
    associated_edge_collection: EdgeCollection,
    gas_gangrene: dict,
    penicillins: dict,
    penicillins_to_gas_gangrene_association_2: dict
):
    return _create_relationship_document(
        associated_edge_collection,
        _from=penicillins['_id'],
        _to=gas_gangrene['_id'],
        assoc_type='Pa',
        description='treatment/therapy (including investigatory)',
        association_id=penicillins_to_gas_gangrene_association_2['_id']
    )


@pytest.fixture(scope='function')
def gas_gangrene_with_associations_and_references(
    test_arango_db,
    has_association_edge_collection,
    indicates_edge_collection,
    in_pub_edge_collection,
    gas_gangrene,
    oxygen,
    penicillins,
    pomc,
    oxygen_to_gas_gangrene_association,
    pomc_to_gas_gangrene_association,
    penicillins_to_gas_gangrene_association_1,
    penicillins_to_gas_gangrene_association_2,
    oxygen_to_gas_gangrene_treatment_edge,
    pomc_to_gas_gangrene_pathogenesis_edge,
    penicillins_to_gas_gangrene_alleviates_edge,
    penicillins_to_gas_gangrene_treatment_edge
):

    # Snippet Nodes
    oxygen_to_gas_gangrene_snippet_node1 = _create_document(
        test_arango_db,
        'literature',
        snippet_id=7430189,
        sentence='In this study , we aimed to investigate the effect of HBO2...',
    )
    oxygen_to_gas_gangrene_snippet_node2 = _create_document(
        test_arango_db,
        'literature',
        snippet_id=1890743,
        sentence='Hyperbaric oxygen therapy has an adjunctive role...',
    )
    penicillins_to_gas_gangrene_snippet_node1 = _create_document(
        test_arango_db,
        'literature',
        snippet_id=9810347,
        sentence='In a mouse model of gas_gangrene caused by...',
    )
    penicillins_to_gas_gangrene_snippet_node2 = _create_document(
        test_arango_db,
        'literature',
        snippet_id=9810346,
        sentence='Toxin suppression and rapid bacterial killing may...',
    )
    penicillins_to_gas_gangrene_snippet_node3 = _create_document(
        test_arango_db,
        'literature',
        snippet_id=9810348,
        sentence='...penicillin was found to reduce the affect of...',
    )
    penicillins_to_gas_gangrene_snippet_node4 = _create_document(
        test_arango_db,
        'literature',
        snippet_id=9810349,
        sentence='...suppresses toxins and rapidly kills bacteria...',
    )

    # Publication Nodes
    oxygen_to_gas_gangrene_publication_node = _create_document(
        test_arango_db,
        'literature',
        pub_id=3,
        pub_year=2019,
    )
    penicillins_to_gas_gangrene_publication_node1 = _create_document(
        test_arango_db,
        'literature',
        pub_id=1,
        pub_year=2014
    )
    penicillins_to_gas_gangrene_publication_node2 = _create_document(
        test_arango_db,
        'literature',
        pub_id=2,
    )

    # Entity -> Association Relationships
    entity_to_association_rels = [
        [oxygen, oxygen_to_gas_gangrene_association],
        [pomc, pomc_to_gas_gangrene_association],
        [penicillins, penicillins_to_gas_gangrene_association_1],
        [penicillins, penicillins_to_gas_gangrene_association_2]
    ]
    for rel in entity_to_association_rels:
        _create_relationship_document(
            has_association_edge_collection,
            _from=rel[0]['_id'],
            _to=rel[1]['_id']
        )

    # Association -> Entity Relationships
    association_to_entity_rels = [
        [oxygen_to_gas_gangrene_association, gas_gangrene],
        [pomc_to_gas_gangrene_association, gas_gangrene],
        [penicillins_to_gas_gangrene_association_1, gas_gangrene],
        [penicillins_to_gas_gangrene_association_2, gas_gangrene]
    ]
    for rel in association_to_entity_rels:
        _create_relationship_document(
            has_association_edge_collection,
            _from=rel[0]['_id'],
            _to=rel[1]['_id'],
        )

    # Snippet -> Association Relationships
    snippet_to_association_rels = [
        [oxygen_to_gas_gangrene_snippet_node1, oxygen_to_gas_gangrene_association, None, None, 'oxygen', 'gas gangrene'],  # noqa
        [oxygen_to_gas_gangrene_snippet_node2, oxygen_to_gas_gangrene_association, None, None, 'oxygen', 'gas gangrene'],  # noqa
        [penicillins_to_gas_gangrene_snippet_node1, penicillins_to_gas_gangrene_association_1, 2, 0.385, 'penicillin', 'gas gangrene'],  # noqa
        [penicillins_to_gas_gangrene_snippet_node3, penicillins_to_gas_gangrene_association_1, 5, 0.693, 'penicillin', 'gas gangrene'],  # noqa
        [penicillins_to_gas_gangrene_snippet_node2, penicillins_to_gas_gangrene_association_2, 1, 0.222, 'penicillin', 'gas gangrene'],  # noqa
        [penicillins_to_gas_gangrene_snippet_node4, penicillins_to_gas_gangrene_association_2, 3, 0.456, 'penicillin', 'gas gangrene'],  # noqa
    ]
    for rel in snippet_to_association_rels:
        _create_relationship_document(
            indicates_edge_collection,
            _from=rel[0]['_id'],
            _to=rel[1]['_id'],
            raw_score=rel[2],
            normalized_score=rel[3],
            entry1_text=rel[4],
            entry2_text=rel[5],
        )

    # Snippet -> Publication Relationships
    snippet_to_pub_rels = [
        [oxygen_to_gas_gangrene_snippet_node1, oxygen_to_gas_gangrene_publication_node],
        [oxygen_to_gas_gangrene_snippet_node2, oxygen_to_gas_gangrene_publication_node],
        [penicillins_to_gas_gangrene_snippet_node1, penicillins_to_gas_gangrene_publication_node1],  # noqa
        [penicillins_to_gas_gangrene_snippet_node3, penicillins_to_gas_gangrene_publication_node2],  # noqa
        [penicillins_to_gas_gangrene_snippet_node2, penicillins_to_gas_gangrene_publication_node2],  # noqa
        [penicillins_to_gas_gangrene_snippet_node4, penicillins_to_gas_gangrene_publication_node2]  # noqa
    ]
    for rel in snippet_to_pub_rels:
        _create_relationship_document(
            in_pub_edge_collection,
            _from=rel[0]['_id'],
            _to=rel[1]['_id']
        )
    return gas_gangrene


@pytest.fixture(scope='function')
def oxygen_duplicate_vis_node(oxygen):
    """Creates a DuplicateVisNode from oxygen"""
    labels = list(oxygen['labels'])
    node_as_graph_node = GraphNode(
        id=oxygen['_id'],
        label=labels[0],
        sub_labels=labels,
        domain_labels=[],
        display_name=oxygen.get(DISPLAY_NAME_MAP[get_first_known_label_from_list(oxygen['labels'])]),  # noqa
        data=snake_to_camel_dict(dict(oxygen), {}),
        url=None,
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
def penicillins_duplicate_vis_node(penicillins):
    """Creates a DuplicateVisNode from penicillins"""
    labels = list(penicillins['labels'])
    node_as_graph_node = GraphNode(
        id=penicillins['_id'],
        label=labels[0],
        sub_labels=labels,
        domain_labels=[],
        display_name=penicillins.get(DISPLAY_NAME_MAP[get_first_known_label_from_list(penicillins['labels'])]),  # noqa
        data=snake_to_camel_dict(dict(penicillins), {}),
        url=None,
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
def oxygen_to_gas_gangrene_treatment_as_duplicate_vis_edge(
    oxygen,
    gas_gangrene,
    oxygen_to_gas_gangrene_treatment_edge,
):
    """Creates a DuplicateVisEdge from the oxygen to gas_gangrene
    alleviates/reduces relationship."""

    edge_as_graph_relationship = GraphRelationship(
        id=oxygen_to_gas_gangrene_treatment_edge['_id'],
        label='associated',
        data=dict(
            assoc_type=oxygen_to_gas_gangrene_treatment_edge['assoc_type'],
            description=oxygen_to_gas_gangrene_treatment_edge['description'],
        ),
        to=oxygen_to_gas_gangrene_treatment_edge['_to'],
        _from=oxygen_to_gas_gangrene_treatment_edge['_from'],
        to_label=gas_gangrene['labels'][0],
        from_label=oxygen['labels'][0]
    )

    oxygen_to_gas_gangrene_treatment_as_duplicate_vis_edge = DuplicateVisEdge(
        id=edge_as_graph_relationship.id,
        label=edge_as_graph_relationship.data['description'],
        data=edge_as_graph_relationship.data,
        to=f'duplicateNode:{edge_as_graph_relationship.to}',  # type:ignore
        from_=f'duplicateNode:{edge_as_graph_relationship._from}',  # type:ignore
        to_label='Disease',
        from_label='Chemical',
        arrows='to',
        duplicate_of=edge_as_graph_relationship.id,
        original_from=edge_as_graph_relationship._from,
        original_to=edge_as_graph_relationship.to,
    )

    return oxygen_to_gas_gangrene_treatment_as_duplicate_vis_edge


@pytest.fixture(scope='function')
def penicillins_to_gas_gangrene_treatment_as_duplicate_vis_edge(
    penicillins,
    gas_gangrene,
    penicillins_to_gas_gangrene_treatment_edge,
):
    """Creates a DuplicateVisEdge from the penicillins to gas_gangrene
    treatment/therapy relationship."""
    edge_as_graph_relationship = GraphRelationship(
        id=penicillins_to_gas_gangrene_treatment_edge['_id'],
        label='associated',
        data=dict(
            assoc_type=penicillins_to_gas_gangrene_treatment_edge['assoc_type'],
            description=penicillins_to_gas_gangrene_treatment_edge['description']
        ),
        to=penicillins_to_gas_gangrene_treatment_edge['_to'],
        _from=penicillins_to_gas_gangrene_treatment_edge['_from'],
        to_label=gas_gangrene['labels'][0],
        from_label=penicillins['labels'][0]
    )

    penicillins_to_gas_gangrene_treatment_as_duplicate_vis_edge = DuplicateVisEdge(
        id=f'duplicateEdge:{edge_as_graph_relationship.id}',
        label=edge_as_graph_relationship.data['description'],
        data=edge_as_graph_relationship.data,
        to=f'duplicateNode:{edge_as_graph_relationship.to}',  # type:ignore
        from_=f'duplicateNode:{edge_as_graph_relationship._from}',  # type:ignore
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
    penicillins,
    gas_gangrene,
    penicillins_to_gas_gangrene_treatment_edge,
):
    edge_as_graph_relationship = GraphRelationship(
        id=penicillins_to_gas_gangrene_treatment_edge['_id'],
        label='associated',
        data=dict(
            assoc_type=penicillins_to_gas_gangrene_treatment_edge['assoc_type'],
            description=penicillins_to_gas_gangrene_treatment_edge['description']
        ),
        to=penicillins_to_gas_gangrene_treatment_edge['_to'],
        _from=penicillins_to_gas_gangrene_treatment_edge['_from'],
        to_label=gas_gangrene['labels'][0],
        from_label=penicillins['labels'][0]
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
    penicillins,
    gas_gangrene,
    penicillins_to_gas_gangrene_alleviates_edge,
):
    edge_as_graph_relationship = GraphRelationship(
        id=penicillins_to_gas_gangrene_alleviates_edge['_id'],
        label='associated',
        data=dict(
            assoc_type=penicillins_to_gas_gangrene_alleviates_edge['assoc_type'],
            description=penicillins_to_gas_gangrene_alleviates_edge['description']
        ),
        to=penicillins_to_gas_gangrene_alleviates_edge['_to'],
        _from=penicillins_to_gas_gangrene_alleviates_edge['_from'],
        to_label=gas_gangrene['labels'][0],
        from_label=penicillins['labels'][0]
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
    penicillins,
    gas_gangrene,
    penicillins_to_gas_gangrene_treatment_edge,
):
    edge_as_graph_relationship = GraphRelationship(
        id=penicillins_to_gas_gangrene_treatment_edge['_id'],
        label='associated',
        data=dict(
            assoc_type=penicillins_to_gas_gangrene_treatment_edge['assoc_type'],
            description=penicillins_to_gas_gangrene_treatment_edge['description']
        ),
        to=penicillins_to_gas_gangrene_treatment_edge['_to'],
        _from=penicillins_to_gas_gangrene_treatment_edge['_from'],
        to_label=gas_gangrene['labels'][0],
        from_label=penicillins['labels'][0]
    )

    return [
            DuplicateEdgeConnectionData(
                label=edge_as_graph_relationship.data['description'],
                to=f'duplicateNode:{edge_as_graph_relationship.to}',  # type:ignore
                from_=f'duplicateNode:{edge_as_graph_relationship._from}',  # type:ignore
                to_label='Disease',
                from_label='Chemical',
                original_from=edge_as_graph_relationship._from,
                original_to=edge_as_graph_relationship.to,
            )
    ]


@pytest.fixture(scope='function')
def gas_gangrene_alleviates_duplicate_edge_data(
    penicillins,
    gas_gangrene,
    penicillins_to_gas_gangrene_alleviates_edge,
):
    edge_as_graph_relationship = GraphRelationship(
        id=penicillins_to_gas_gangrene_alleviates_edge['_id'],
        label='associated',
        data=dict(
            assoc_type=penicillins_to_gas_gangrene_alleviates_edge['assoc_type'],
            description=penicillins_to_gas_gangrene_alleviates_edge['description']
        ),
        to=penicillins_to_gas_gangrene_alleviates_edge['_to'],
        _from=penicillins_to_gas_gangrene_alleviates_edge['_from'],
        to_label=gas_gangrene['labels'][0],
        from_label=penicillins['labels'][0]
    )

    return [
            DuplicateEdgeConnectionData(
                label=edge_as_graph_relationship.data['description'],
                to=f'duplicateNode:{edge_as_graph_relationship.to}',  # type:ignore
                from_=f'duplicateNode:{edge_as_graph_relationship._from}',  # type:ignore
                to_label='Disease',
                from_label='Chemical',
                original_from=edge_as_graph_relationship._from,
                original_to=edge_as_graph_relationship.to,
            )
    ]
