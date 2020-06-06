import os
import pytest
import json
from io import BytesIO
from werkzeug.datastructures import FileStorage


def generate_headers(jwt_token):
    return {'Authorization': f'Bearer {jwt_token}'}


def test_user_can_delete_own_pdf(client, test_user_with_pdf, test_user):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])
    file_id = test_user_with_pdf.id
    delete_resp = client.delete(
        '/files/bulk_delete',
        data=json.dumps({file_id: file_id}),
        headers=headers,
        content_type='application/json',
    )
    assert delete_resp.status_code == 200


def test_user_cannot_delete_pdf_without_permission(client, test_user_with_pdf, test_user_2):
    login_resp = client.login_as_user(test_user_2.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])
    file_id = test_user_with_pdf.id
    delete_resp = client.delete(
        '/files/bulk_delete',
        data=json.dumps({file_id: file_id}),
        headers=headers,
        content_type='application/json',
    )
    assert delete_resp.status_code == 200
    resp_json = [resp for resp in delete_resp.get_json().values()]
    assert 'Not an owner' in resp_json


def test_admin_can_delete_pdf_without_permission(client, test_user_with_pdf, fix_api_owner):
    login_resp = client.login_as_user(fix_api_owner.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])
    file_id = test_user_with_pdf.id
    delete_resp = client.delete(
        '/files/bulk_delete',
        data=json.dumps({file_id: file_id}),
        headers=headers,
        content_type='application/json',
    )
    assert delete_resp.status_code == 200
    resp_json = [resp for resp in delete_resp.get_json().values()]
    assert 'Not an owner' not in resp_json


def test_can_upload_pdf(monkeypatch, client, test_user, fix_project, fix_directory):
    from neo4japp.blueprints import files

    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])

    def mockannotate(filename, pdf):
        """ Mocks out the 'annotate' function in the module
        since we don't care about the annotation process """
        return dict()

    monkeypatch.setattr(files, 'annotate', mockannotate)
    mock_pdf = BytesIO(json.dumps(dict()).encode('utf-8'))

    resp = client.post(
        '/files/upload',
        headers=headers,
        data={
            'file': (mock_pdf, 'mock.pdf'),
            'directoryId': fix_directory.id,
        },
        content_type='multipart/form-data'
    )

    assert resp.status_code == 200


def test_cannot_upload_if_no_write_permission(
        monkeypatch, client, test_user, test_user_2, fix_project, fix_directory):
    from neo4japp.blueprints import files

    login_resp = client.login_as_user(test_user_2.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])

    def mockannotate(filename, pdf):
        """ Mocks out the 'annotate' function in the module
        since we don't care about the annotation process """
        return dict()

    monkeypatch.setattr(files, 'annotate', mockannotate)
    mock_pdf = BytesIO(json.dumps(dict()).encode('utf-8'))

    resp = client.post(
        '/files/upload',
        headers=headers,
        data={
            'file': (mock_pdf, 'mock.pdf'),
            'directoryId': fix_directory.id,
        },
        content_type='multipart/form-data'
    )

    assert resp.status_code == 400
