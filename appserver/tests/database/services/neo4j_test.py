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