import pytest


def test_expand_node_gets_no_results_for_node_with_no_relationships(neo4j_service_dao, gas_gangrene):  # noqa
    expand_query_result = neo4j_service_dao.expand_graph(
        node_id=gas_gangrene.identity,
        limit=1,
    )

    assert expand_query_result.get('nodes', None) is not None
    assert expand_query_result.get('nodes', None) is not None

    assert expand_query_result['nodes'] == []
    assert expand_query_result['edges'] == []


def test_expand_node_can_limit_results(
    neo4j_service_dao,
    gas_gangrene_with_associations_and_references,
):
    expand_query_result = neo4j_service_dao.expand_graph(
        node_id=gas_gangrene_with_associations_and_references.identity,
        limit=1,
    )

    assert expand_query_result.get('nodes', None) is not None
    assert expand_query_result.get('nodes', None) is not None

    assert len(expand_query_result['nodes']) == 2
    assert len(expand_query_result['edges']) == 1


def test_get_snippets_from_edge_returns_nothing_for_relationship_with_no_references(
    neo4j_service_dao,
    pomc_to_gas_gangrene_pathogenesis_as_vis_edge,
):
    get_snippets_from_edge_result = neo4j_service_dao.get_snippets_from_edge(
        pomc_to_gas_gangrene_pathogenesis_as_vis_edge,
    )

    assert get_snippets_from_edge_result is not None
    assert get_snippets_from_edge_result.association == 'role in disease pathogenesis'
    assert len(get_snippets_from_edge_result.references) == 0


def test_get_snippets_from_edge_can_get_references_for_relationship(
    neo4j_service_dao,
    penicillins_to_gas_gangrene_alleviates_as_vis_edge,
    gas_gangrene_with_associations_and_references,
):
    get_snippets_from_edge_result = neo4j_service_dao.get_snippets_from_edge(
        penicillins_to_gas_gangrene_alleviates_as_vis_edge,
    )

    assert get_snippets_from_edge_result is not None
    assert get_snippets_from_edge_result.association == 'alleviates, reduces'
    assert len(get_snippets_from_edge_result.references) == 1
    assert 'In a mouse model' in get_snippets_from_edge_result.references[0]['sentence']


def test_get_snippets_from_duplicate_edge_returns_nothing_for_relationship_with_no_references(
    neo4j_service_dao,
    pomc_to_gas_gangrene_pathogenesis_as_duplicate_vis_edge,
    gas_gangrene_with_associations_and_references,
):
    get_snippets_from_duplicate_edge_result = neo4j_service_dao.get_snippets_from_duplicate_edge(
        pomc_to_gas_gangrene_pathogenesis_as_duplicate_vis_edge,
    )

    assert get_snippets_from_duplicate_edge_result is not None
    assert get_snippets_from_duplicate_edge_result.association == 'role in disease pathogenesis'
    assert len(get_snippets_from_duplicate_edge_result.references) == 0


def test_get_snippets_from_duplicate_edge_can_get_references_for_relationship(
    neo4j_service_dao,
    penicillins_to_gas_gangrene_alleviates_as_duplicate_vis_edge,
    gas_gangrene_with_associations_and_references,
):
    get_snippets_from_duplicate_edge_result = neo4j_service_dao.get_snippets_from_duplicate_edge(
        penicillins_to_gas_gangrene_alleviates_as_duplicate_vis_edge,
    )

    assert get_snippets_from_duplicate_edge_result is not None
    assert get_snippets_from_duplicate_edge_result.association == 'alleviates, reduces'
    assert len(get_snippets_from_duplicate_edge_result.references) == 1
    assert 'In a mouse model' in get_snippets_from_duplicate_edge_result.references[0]['sentence']


def test_get_reference_table_data(
    neo4j_service_dao,
    gas_gangrene_treatment_cluster_node_edge_pairs,
    gas_gangrene_with_associations_and_references,
):
    get_reference_table_data_result = neo4j_service_dao.get_reference_table_data(
        gas_gangrene_treatment_cluster_node_edge_pairs,
    )

    assert get_reference_table_data_result.reference_table_rows is not None

    reference_table_rows = get_reference_table_data_result.reference_table_rows

    assert len(reference_table_rows) == 1
    assert reference_table_rows[0].node_display_name == 'Penicillins'
    assert reference_table_rows[0].snippet_count == 1


def test_get_cluster_graph_data(
    neo4j_service_dao,
    gas_gangrene_treatment_clustered_nodes,
    gas_gangrene_with_associations_and_references,
):
    get_cluster_graph_data_result = neo4j_service_dao.get_cluster_graph_data(
        gas_gangrene_treatment_clustered_nodes,
    )

    assert get_cluster_graph_data_result.results is not None
    assert len(get_cluster_graph_data_result.results.keys()) == 1

    node_id = list(get_cluster_graph_data_result.results.keys())[0]

    assert len(get_cluster_graph_data_result.results[node_id].keys()) == 1

    edge_id = list(get_cluster_graph_data_result.results[node_id].keys())[0]

    assert get_cluster_graph_data_result.results[node_id][edge_id] == 1
