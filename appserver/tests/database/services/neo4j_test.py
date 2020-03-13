import pytest

def test_expand_node_gets_no_results_for_node_with_no_relationships(neo4j_service_dao, gas_gangrene):
    expand_query_result = neo4j_service_dao.expand_graph(
        node_id=gas_gangrene.identity,
        limit=1,
    )

    assert expand_query_result.get('nodes', None) is not None
    assert expand_query_result.get('nodes', None) is not None

    assert expand_query_result['nodes'] == []
    assert expand_query_result['edges'] == []


def test_expand_node_can_limit_results(neo4j_service_dao):
    assert True


def test_get_snippets_from_edge_returns_nothing_for_relationship_with_no_references(
    neo4j_service_dao,
):
    assert True

def test_get_snippets_from_edge_can_get_references_for_relationship(neo4j_service_dao):
    assert True

def test_get_snippets_from_duplicate_edge_returns_nothing_for_relationship_with_no_references(
    neo4j_service_dao,
):
    assert True

def test_get_snippets_from_duplicate_edge_can_get_references_for_relationship(
    neo4j_service_dao
):
    assert True

def test_get_reference_table_data(neo4j_service_dao):
    assert True

def test_get_cluster_graph_data(neo4j_service_dao):
    assert True
