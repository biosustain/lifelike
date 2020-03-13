import pytest
import json

def test_expand(client, gas_gangrene):
    response = client.post('/neo4j/expand',
                data=json.dumps(dict(
                    node_id=gas_gangrene.identity,
                    limit=10,
                )), content_type='application/json'
    )

    assert response.status_code == 200


def test_get_snippets_from_edge(
    client,
    penicillins_to_gas_gangrene_alleviates_as_vis_edge,
):
    response = client.post('/neo4j/get-snippets-from-edge',
                data=json.dumps(dict(
                    edge=penicillins_to_gas_gangrene_alleviates_as_vis_edge.to_dict(),
                )), content_type='application/json'
    )

    assert response.status_code == 200


def test_get_snippets_from_duplicate_edge(
    client,
    penicillins_to_gas_gangrene_alleviates_as_duplicate_vis_edge,
):
    response = client.post('/neo4j/get-snippets-from-duplicate-edge',
                data=json.dumps(dict(
                    edge=penicillins_to_gas_gangrene_alleviates_as_duplicate_vis_edge.to_dict(),
                )), content_type='application/json'
    )

    assert response.status_code == 200


def test_get_reference_table_data(
    client,
    gas_gangrene_treatment_cluster_node_edge_pairs,
):
    response = client.post('/neo4j/get-reference-table-data',
                data=json.dumps(dict(
                    node_edge_pairs=[
                        pair.to_dict()
                        for pair in gas_gangrene_treatment_cluster_node_edge_pairs
                    ],
                )), content_type='application/json'
    )

    assert response.status_code == 200


def test_get_cluster_graph_data(
    client,
    gas_gangrene_treatment_clustered_nodes,
):
    response = client.post('/neo4j/get-cluster-graph-data',
                data=json.dumps(dict(
                    clustered_nodes=[
                        cluster_node.to_dict()
                        for cluster_node in gas_gangrene_treatment_clustered_nodes
                    ],
                )), content_type='application/json'
    )

    assert response.status_code == 200
