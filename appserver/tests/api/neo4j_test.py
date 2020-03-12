import pytest
import json

def test_can_expand_node(client, gas_gangrene):
    response = client.post('/neo4j/expand',
                data=json.dumps(dict(
                    node_id=gas_gangrene.identity,
                    limit=10,
                )), content_type='application/json'
    )

    assert response.status_code == 200

    expand_result = json.loads(response.data)

    assert expand_result['result'] is not None
    assert expand_result['result'].get('nodes', None) is not None
    assert expand_result['result'].get('edges', None) is not None

    assert len(expand_result['result']['nodes']) == 0
    assert len(expand_result['result']['edges']) == 0
