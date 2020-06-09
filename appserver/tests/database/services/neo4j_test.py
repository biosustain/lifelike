import pytest


def test_expand_node_gets_no_results_for_node_with_no_relationships(
    neo4j_service_dao,
    gas_gangrene
):
    expand_query_result = neo4j_service_dao.expand_graph(
        node_id=gas_gangrene.identity,
        limit=1,
        filter_labels=['Chemical', 'Disease', 'Gene'],
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
        filter_labels=['Chemical', 'Disease', 'Gene'],
    )

    assert expand_query_result.get('nodes', None) is not None
    assert expand_query_result.get('nodes', None) is not None

    assert len(expand_query_result['nodes']) == 2
    assert len(expand_query_result['edges']) == 1


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
    assert reference_table_rows[0].snippet_count == 2


def test_get_snippets_for_edge(
    neo4j_service_dao,
    gas_gangrene_treatement_edge_data,
    gas_gangrene_with_associations_and_references,
):
    get_edge_data_result = neo4j_service_dao.get_snippets_for_edge(
        edge=gas_gangrene_treatement_edge_data,
        page=1,
        limit=25,
    )

    result = get_edge_data_result.snippet_data

    # Check snippet data
    assert len(result.snippets) == 2
    assert result.association == 'treatment/therapy (including investigatory)'

    sentences = [
        'Toxin suppression and rapid bacterial killing may...',
        '...suppresses toxins and rapidly kills bacteria...',
    ]

    assert result.snippets[0].reference.data['sentence'] in sentences
    assert result.snippets[1].reference.data['sentence'] in sentences


def test_get_snippets_for_edge_low_limit(
    neo4j_service_dao,
    gas_gangrene_treatement_edge_data,
    gas_gangrene_with_associations_and_references,
):
    get_edge_data_result = neo4j_service_dao.get_snippets_for_edge(
        edge=gas_gangrene_treatement_edge_data,
        page=1,
        limit=1,
    )

    result = get_edge_data_result.snippet_data

    # Check snippet data
    assert len(result.snippets) == 1
    assert result.association == 'treatment/therapy (including investigatory)'

    sentences = [
        'Toxin suppression and rapid bacterial killing may...',
        '...suppresses toxins and rapidly kills bacteria...',
    ]

    assert result.snippets[0].reference.data['sentence'] in sentences


def test_get_snippets_for_edge_orders_by_pub_year(
    neo4j_service_dao,
    gas_gangrene_alleviates_edge_data,
    gas_gangrene_with_associations_and_references,
):
    get_edge_data_result = neo4j_service_dao.get_snippets_for_edge(
        edge=gas_gangrene_alleviates_edge_data,
        page=1,
        limit=25,
    )

    result = get_edge_data_result.snippet_data

    # Check snippet data
    assert len(result.snippets) == 2
    assert result.association == 'alleviates, reduces'

    reference_node1 = result.snippets[0].reference.to_dict()
    reference_node2 = result.snippets[1].reference.to_dict()

    assert 'penicillin was found to reduce' in reference_node1['data']['sentence']
    assert 'In a mouse model' in reference_node2['data']['sentence']


def test_get_snippets_for_cluster(
    neo4j_service_dao,
    gas_gangrene_treatement_duplicate_edge_data,
    gas_gangrene_with_associations_and_references,
):
    get_cluster_data_result = neo4j_service_dao.get_snippets_for_cluster(
        edges=gas_gangrene_treatement_duplicate_edge_data,
        page=1,
        limit=25,
    )

    snippet_data = get_cluster_data_result.snippet_data

    # Check snippet data
    assert len(snippet_data) == 1

    result = snippet_data[0]

    assert len(result.snippets) == 2
    assert result.association == 'treatment/therapy (including investigatory)'

    sentences = [
        'Toxin suppression and rapid bacterial killing may...',
        '...suppresses toxins and rapidly kills bacteria...',
    ]

    assert result.snippets[0].reference.data['sentence'] in sentences
    assert result.snippets[1].reference.data['sentence'] in sentences


def test_get_snippets_for_cluster_low_limit(
    neo4j_service_dao,
    gas_gangrene_treatement_duplicate_edge_data,
    gas_gangrene_with_associations_and_references,
):
    get_cluster_data_result = neo4j_service_dao.get_snippets_for_cluster(
        edges=gas_gangrene_treatement_duplicate_edge_data,
        page=1,
        limit=1,
    )

    snippet_data = get_cluster_data_result.snippet_data

    # Check snippet data
    assert len(snippet_data) == 1

    result = snippet_data[0]

    assert len(result.snippets) == 1
    assert result.association == 'treatment/therapy (including investigatory)'

    sentences = [
        'Toxin suppression and rapid bacterial killing may...',
        '...suppresses toxins and rapidly kills bacteria...',
    ]

    assert result.snippets[0].reference.data['sentence'] in sentences


def test_get_snippets_for_cluster_orders_by_pub_year(
    neo4j_service_dao,
    gas_gangrene_alleviates_duplicate_edge_data,
    gas_gangrene_with_associations_and_references,
):
    get_cluster_data_result = neo4j_service_dao.get_snippets_for_cluster(
        edges=gas_gangrene_alleviates_duplicate_edge_data,
        page=1,
        limit=25,
    )

    snippet_data = get_cluster_data_result.snippet_data

    # Check snippet data
    assert len(snippet_data) == 1

    result = snippet_data[0]

    assert len(result.snippets) == 2
    assert result.association == 'alleviates, reduces'

    reference_node1 = result.snippets[0].reference.to_dict()
    reference_node2 = result.snippets[1].reference.to_dict()

    assert 'penicillin was found to reduce' in reference_node1['data']['sentence']
    assert 'In a mouse model' in reference_node2['data']['sentence']
