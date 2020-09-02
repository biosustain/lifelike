import pytest
import json


@pytest.mark.skip(
    reason='Does not work unless we upgrade the Neo4j docker image to 4.0+ because of apoc function'
)
def test_expand(client, gas_gangrene):
    response = client.post(
        '/visualizer/expand',
        data=json.dumps({
            'node_id': 1,
            'filter_labels': ['Chemical', 'Disease', 'Gene'],
        }), content_type='application/json'
    )

    assert response.status_code == 200


def test_get_reference_table_data(
    client,
    gas_gangrene_treatment_cluster_node_edge_pairs,
):
    response = client.post(
        '/visualizer/get-reference-table-data',
        data=json.dumps({
            'node_edge_pairs': [
                {
                    'node': {
                        'id': f'duplicateNode:1',
                        'label': 'Chemical',
                        'data': {},
                        'sub_labels': [],
                        'display_name': 'penicillins',
                        'primary_label': 'Chemical',
                        'color': {},
                        'expanded': False,
                        'duplicate_of': 1,
                    },
                    'edge': {
                        'id': 'duplicateEdge:1',
                        'label': 'ASSOCIATED',
                        'data': {},
                        'to': 'duplicateNode:1',
                        'from_': 'duplicateNode:2',
                        'to_label': 'Disease',
                        'from_label': 'Chemical',
                        'arrows': 'to',
                        'duplicate_of': 1,
                        'original_from': 2,
                        'original_to': 1,
                    },
                },
            ],
        }), content_type='application/json'
    )

    assert response.status_code == 200


def test_get_snippets_for_edge(
    client,
):
    response = client.post(
        '/visualizer/get-snippets-for-edge',
        data=json.dumps({
            'page': 1,
            'limit': 25,
            'edge': {
                'to': 1,
                'from': 2,
                'fromLabel': 'Chemical',
                'toLabel': 'Disease',
                'label': 'ASSOCIATED',
            }
        }), content_type='application/json'
    )

    assert response.status_code == 200


def test_get_snippets_for_cluster(
    client,
):
    response = client.post(
        '/visualizer/get-snippets-for-cluster',
        data=json.dumps({
            'page': 1,
            'limit': 25,
            'edges': [
                {
                    'to': 'duplicateNode:1',
                    'from': 'duplicateNode:2',
                    'originalFrom': 2,
                    'originalTo': 1,
                    'fromLabel': 'Chemical',
                    'toLabel': 'Disease',
                    'label': 'ASSOCIATED',
                }
            ]
        }), content_type='application/json'
    )

    assert response.status_code == 200
