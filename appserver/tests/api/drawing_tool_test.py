import pytest
import json
from datetime import datetime
from io import BytesIO
from neo4japp.data_transfer_objects import DrawingUploadRequest
from neo4japp.models import Project


def generate_headers(jwt_token):
    return {'Authorization': f'Bearer {jwt_token}'}


def test_uri_hash(
    client,
    fix_project,
    private_fix_map,
):
    """ Test basic implementation of map's URI """

    # Get owner JWT to authenticate
    resp = client.post(
        '/auth/login',
        data=json.dumps({
            "email": "admin@***ARANGO_DB_NAME***.bio",
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
        f'/projects/{fix_project.project_name}/map/{private_fix_map.hash_id}',
        headers=headers
    )

    assert resp.status_code == 200
    assert resp.get_json().get('project').get('label') == 'Project1'


@pytest.mark.skip("TODO: LL-415 - file assets themselves are now owned by the 'project', not users")
def test_uri_private_maps(
    client,
    fix_project,
    private_fix_map,
    test_user_2,
):
    """ Test to make sure that maps needs READ permission """
    # Get owner JWT to authenticate
    resp = client.post(
        '/auth/login',
        data=json.dumps({
            "email": test_user_2.email,
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
        f'/projects/{fix_project.project_name}/map/{private_fix_map.hash_id}',
        headers=headers
    )

    assert resp.status_code == 400


def test_can_download_map(
    client,
    fix_project,
    fix_api_owner,
    private_fix_map,
):
    login_resp = client.login_as_user(
        fix_api_owner.email,
        'password',
    )
    headers = generate_headers(login_resp['access_jwt'])
    proj_label = private_fix_map.label
    proj_hash = private_fix_map.hash_id
    resp = client.get(
        f'/projects/{fix_project.project_name}/map/{private_fix_map.hash_id}/download',
        headers=headers,
    )

    assert resp.headers.get('Content-Disposition') == f'attachment;filename={proj_label}.json'


def test_can_upload_map(client, fix_api_owner, fix_project, fix_directory, session):
    login_resp = client.login_as_user(fix_api_owner.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])
    mock_data = BytesIO(json.dumps({'graph': {'edges': [], 'nodes': []}}).encode('utf-8'))
    res = client.post(
        f'/projects/{fix_project.project_name}/map/upload',
        headers=headers,
        data={
            'description': 'test',
            'projectName': 'tester',
            'dirId': f'{fix_directory.id}',
            'fileInput': (mock_data, 'testfile.json')
        },
        content_type='multipart/form-data'
    )
    assert res.status_code == 200

    uploaded = Project.query.filter_by(label='tester').one_or_none()

    assert uploaded is not None


def test_can_add_map(client, fix_api_owner, fix_project, fix_directory):
    login_resp = client.login_as_user(fix_api_owner.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])
    res = client.post(
        f'/projects/{fix_project.project_name}/map',
        headers=headers,
        data=json.dumps({
            'first_name': fix_api_owner.first_name,
            'last_name': fix_api_owner.last_name,
            'description': 'test',
            'directoryId': f'{fix_directory.id}',
            'graph': {"graph": [], "edges": []},
            'label': 'my-map',
            'date_modified': datetime.now().strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
        }),
        content_type='application/json'
    )
    assert res.status_code == 200


def test_can_update_map(client, fix_api_owner, fix_project, private_fix_map):
    login_resp = client.login_as_user(fix_api_owner.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])
    res = client.patch(
        f'/projects/{fix_project.project_name}/map/{private_fix_map.hash_id}',
        headers=headers,
        data=json.dumps({'label': 'new-label'}),
        content_type='application/json'
    )
    assert res.status_code == 200


def test_can_delete_map(client, fix_api_owner, fix_project, private_fix_map):
    login_resp = client.login_as_user(fix_api_owner.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])
    res = client.delete(
        f'/projects/{fix_project.project_name}/map/{private_fix_map.hash_id}',
        headers=headers,
    )
    assert res.status_code == 200


def test_can_get_pdf_from_map(client, fix_api_owner, fix_project, private_fix_map):
    login_resp = client.login_as_user(fix_api_owner.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])
    res = client.get(
        f'/projects/{fix_project.project_name}/map/{private_fix_map.hash_id}/pdf',
        headers=headers,
    )
    assert res.status_code == 200
