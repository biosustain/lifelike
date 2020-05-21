import pytest
import json
from io import BytesIO
from neo4japp.data_transfer_objects import DrawingUploadRequest
from neo4japp.models import Project


def generate_headers(jwt_token):
    return {'Authorization': f'Bearer {jwt_token}'}


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


def test_can_download_map(
    client,
    fix_api_owner,
    private_fix_project,
):
    login_resp = client.login_as_user(
        fix_api_owner.email,
        'password',
    )
    headers = generate_headers(login_resp['access_jwt'])
    proj_label = private_fix_project.label
    proj_hash = private_fix_project.hash_id
    resp = client.get(
        f'/drawing-tool/map/download/{proj_hash}',
        headers=headers,
    )

    assert resp.headers.get('Content-Disposition') == f'attachment;filename={proj_label}.json'


def test_can_upload_map(client, fix_api_owner, session):
    login_resp = client.login_as_user(fix_api_owner.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])
    mock_data = BytesIO(json.dumps({'graph': {'edges': [], 'nodes': []}}).encode('utf-8'))
    res = client.post(
        '/drawing-tool/map/upload',
        headers=headers,
        data={
            'description': 'test',
            'project_name': 'tester',
            'fileInput': (mock_data, 'testfile.json')
        },
        content_type='multipart/form-data'
    )
    assert res.status_code == 200

    uploaded = Project.query.filter_by(label='tester').one_or_none()

    assert uploaded is not None
