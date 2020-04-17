import pytest


def test_can_get_hardcoded_project(user_client):
    client, auth_info = user_client

    access_jwt = auth_info['access_jwt']
    headers = {'Authorization': f'Bearer {access_jwt}'}
    response = client.get(
        '/projects/beta-project',
        headers=headers
    )
    resp_json = response.get_json()['project']['projectName']
    assert resp_json == 'beta-project'
