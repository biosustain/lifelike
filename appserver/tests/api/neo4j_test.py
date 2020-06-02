import pytest
import json


def test_expand(client, gas_gangrene):
    response = client.post(
        '/neo4j/expand',
        data=json.dumps(dict(
            node_id=1,
            limit=10,
            filter_labels=['Chemical', 'Disease', 'Gene'],
        )), content_type='application/json'
    )

    assert response.status_code == 200


def test_get_snippets_from_edge(
    client,
    penicillins_to_gas_gangrene_alleviates_as_vis_edge,
):
    response = client.post(
        '/neo4j/get-snippets-from-edge',
        data=json.dumps(dict(
            edge=dict(
                id=1,
                label='ASSOCIATED',
                data=dict(),
                to=1,
                from_=2,
                to_label='Disease',
                from_label='Chemical',
                arrows='to',
            ),
        )), content_type='application/json'
    )

    assert response.status_code == 200


def test_get_reference_table_data(
    client,
    gas_gangrene_treatment_cluster_node_edge_pairs,
):
    response = client.post(
        '/neo4j/get-reference-table-data',
        data=json.dumps(dict(
            node_edge_pairs=[
                dict(
                    node=dict(
                        id=f'duplicateNode:1',
                        label='Chemical',
                        data=dict(),
                        sub_labels=[],
                        display_name='penicillins',
                        primary_label='Chemical',
                        color=dict(),
                        expanded=False,
                        duplicate_of=1,
                    ),
                    edge=dict(
                        id='duplicateEdge:1',
                        label='ASSOCIATED',
                        data=dict(),
                        to='duplicateNode:1',
                        from_='duplicateNode:2',
                        to_label='Disease',
                        from_label='Chemical',
                        arrows='to',
                        duplicate_of=1,
                        original_from=2,
                        original_to=1,
                    ),
                ),
            ],
        )), content_type='application/json'
    )

    assert response.status_code == 200


def test_get_cluster_graph_data(
    client,
    gas_gangrene_treatment_clustered_nodes,
):
    response = client.post(
        '/neo4j/get-cluster-graph-data',
        data=json.dumps(dict(
            clustered_nodes=[
                dict(
                    node_id='duplicateNode:1',
                    edges=[
                        dict(
                            id='duplicateEdge:1',
                            label='ASSOCIATED',
                            data=dict(),
                            to='duplicateNode:1',
                            from_='duplicateNode:2',
                            to_label='Disease',
                            from_label='Chemical',
                            arrows='to',
                            duplicate_of=1,
                            original_from=2,
                            original_to=1,
                        ),
                    ],
                ),
            ],
        )), content_type='application/json'
    )

    assert response.status_code == 200


# TODO LL-906: Need to update this
def test_get_cluster_data(
    client,
    gas_gangrene_treatment_clustered_nodes,
):
    response = client.post(
        '/neo4j/get-snippets-for-cluster',
        data=json.dumps(dict(
            clustered_nodes=[
                dict(
                    node_id='duplicateNode:1',
                    edges=[
                        dict(
                            id='duplicateEdge:1',
                            label='ASSOCIATED',
                            data=dict(),
                            to='duplicateNode:1',
                            from_='duplicateNode:2',
                            to_label='Disease',
                            from_label='Chemical',
                            arrows='to',
                            duplicate_of=1,
                            original_from=2,
                            original_to=1,
                        ),
                    ],
                ),
            ],
        )), content_type='application/json'
    )

    assert response.status_code == 200
