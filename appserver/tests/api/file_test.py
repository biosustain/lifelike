import os
import pytest
import json
from io import BytesIO
from werkzeug.datastructures import FileStorage


def generate_headers(jwt_token):
    return {'Authorization': f'Bearer {jwt_token}'}


def test_user_can_upload_pdf(client, pdf_dir, test_user):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])
    pdf = os.path.join(pdf_dir, 'example4.pdf')
    pdf_file = FileStorage(
        stream=open(pdf, 'rb'),
        filename='example4.pdf',
        content_type='application/pdf'
    )
    file_resp = client.post(
        '/files/upload',
        data=dict(file=pdf_file),
        headers=headers,
        content_type='multipart/form-data',
    )
    assert file_resp.status_code == 200


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


def test_admin_can_delete_pdf_without_permission(client, test_user_with_pdf, fix_owner):
    login_resp = client.login_as_user(fix_owner.email, 'password')
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
