import json

from http import HTTPStatus


def generate_headers(jwt_token):
    return {'Authorization': f'Bearer {jwt_token}'}


def test_get_reference_table_data(client, test_user, test_arango_db):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['accessToken']['token'])
    response = client.post(
        '/visualizer/get-reference-table',
        data=json.dumps(
            {
                'nodeEdgePairs': [
                    {
                        'node': {
                            'id': f'duplicateNode:1',
                            'label': 'Chemical',
                            'displayName': 'penicillins',
                        },
                        'edge': {
                            'label': 'ASSOCIATED',
                            'originalFrom': '2',
                            'originalTo': '1',
                        },
                    },
                ],
                'description': 'treatment/therapy',
                'direction': 'Outgoing',
            }
        ),
        headers=headers,
        content_type='application/json',
    )

    assert response.status_code == HTTPStatus.OK


def test_get_snippets_for_edge(client, test_user, test_arango_db):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['accessToken']['token'])
    response = client.post(
        '/visualizer/get-snippets-for-edge',
        data=json.dumps(
            {
                'page': 1,
                'limit': 25,
                'edge': {
                    'to': 1,
                    'from': 2,
                    'fromLabel': 'Chemical',
                    'toLabel': 'Disease',
                    'label': 'ASSOCIATED',
                },
            }
        ),
        headers=headers,
        content_type='application/json',
    )

    assert response.status_code == HTTPStatus.OK


def test_get_snippets_for_cluster(client, test_user, test_arango_db):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['accessToken']['token'])
    response = client.post(
        '/visualizer/get-snippets-for-cluster',
        data=json.dumps(
            {
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
                ],
            }
        ),
        headers=headers,
        content_type='application/json',
    )

    assert response.status_code == HTTPStatus.OK
