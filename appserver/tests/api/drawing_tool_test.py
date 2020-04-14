import pytest
import json


def test_uri_hash(
    client,
    private_fix_project,
):
    """
        Test basic implementation of map's URI
    """

    # Get owner JWT to authenticate
    resp = client.post(
        '/auth/login',
        data=json.dumps({
            "email": "admin@lifelike.bio",
            "password": "password"
        }),
        content_type='application/json'
    )

    jwt = resp.get_json()['access_jwt']

    headers = {
        'Authorization': 'Bearer {}'.format(
            jwt
        )
    }

    # Pull project with auth by hash_id of project
    resp = client.get(
        '/drawing-tool/map/{}'.format(private_fix_project.hash_id),
        headers=headers
    )

    assert resp.status_code == 200
    assert resp.get_json().get('project').get('label') == 'Project1'


def test_uri_private_maps(
    client,
    private_fix_project,
    test_user
):
    """ Test to make sure that maps made private
        and not owned aren't served
    """
    # Get owner JWT to authenticate
    resp = client.post(
        '/auth/login',
        data=json.dumps({
            "email": "test@lifelike.bio",
            "password": "password"
        }),
        content_type='application/json'
    )

    jwt = resp.get_json()['access_jwt']

    headers = {
        'Authorization': 'Bearer {}'.format(
            jwt
        )
    }

    # Pull project with auth by hash_id of project
    resp = client.get(
        '/drawing-tool/map/{}'.format(private_fix_project.hash_id),
        headers=headers
    )

    assert resp.status_code == 404
