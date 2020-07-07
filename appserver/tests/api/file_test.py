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


CUSTOM_ANNOTATION = {
    'pageNumber': 1,
    'keywords': ['gyrA'],
    'rects': [[0.1, 0.2, 0.3, 0.4]],
    'meta': {
        'type': 'gene',
        'color': 'green',
        'id': '',
        'idType': '',
        'idHyperlink': '',
        'isCustom': True,
        'allText': 'gyrA',
        'links': {
            'ncbi': '',
            'uniprot': '',
            'wikipedia': '',
            'google': ''
        },
        'primaryLink': ''
    },
}


def test_user_can_add_custom_annotation(client, test_user, test_user_with_pdf):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])
    file_id = test_user_with_pdf.file_id

    resp = client.patch(
        f'/files/add_custom_annotation/{file_id}',
        headers=headers,
        data=json.dumps(CUSTOM_ANNOTATION),
        content_type='application/json',
    )

    assert resp.status_code == 200
    assert 'uuid' in resp.get_json()


def test_user_can_remove_custom_annotation(client, test_user, test_user_with_pdf):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])
    file_id = test_user_with_pdf.file_id

    add_resp = client.patch(
        f'/files/add_custom_annotation/{file_id}',
        headers=headers,
        data=json.dumps(CUSTOM_ANNOTATION),
        content_type='application/json',
    )

    uuid = add_resp.get_json()['uuid']

    remove_resp = client.patch(
        f'/files/remove_custom_annotation/{file_id}',
        headers=headers,
        data=json.dumps({
            'uuid': uuid,
            'removeAll': False
        }),
        content_type='application/json',
    )

    assert remove_resp.status_code == 200
    assert remove_resp.get_json()[uuid] == 'Removed'


def test_user_can_remove_matching_custom_annotations(client, test_user, test_user_with_pdf):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])
    file_id = test_user_with_pdf.file_id

    add_resp_1 = client.patch(
        f'/files/add_custom_annotation/{file_id}',
        headers=headers,
        data=json.dumps(CUSTOM_ANNOTATION),
        content_type='application/json',
    )

    uuid_1 = add_resp_1.get_json()['uuid']

    add_resp_2 = client.patch(
        f'/files/add_custom_annotation/{file_id}',
        headers=headers,
        data=json.dumps(CUSTOM_ANNOTATION),
        content_type='application/json',
    )

    uuid_2 = add_resp_2.get_json()['uuid']

    remove_resp = client.patch(
        f'/files/remove_custom_annotation/{file_id}',
        headers=headers,
        data=json.dumps({
            'uuid': uuid_2,
            'removeAll': True
        }),
        content_type='application/json',
    )

    assert remove_resp.status_code == 200
    assert remove_resp.get_json()[uuid_1] == 'Removed'
    assert remove_resp.get_json()[uuid_2] == 'Removed'


def test_user_can_remove_annotation_exclusion(client, test_user, test_user_with_pdf):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])
    file_id = test_user_with_pdf.file_id

    add_exc_resp = client.patch(
        f'/files/add_annotation_exclusion/{file_id}',
        headers=headers,
        data=json.dumps({
            'id': 'id',
            'reason': 'reason',
            'comment': 'comment'
        }),
        content_type='application/json',
    )

    remove_exc_resp = client.patch(
        f'/files/remove_annotation_exclusion/{file_id}',
        headers=headers,
        data=json.dumps({'id': 'id'}),
        content_type='application/json',
    )

    assert remove_exc_resp.status_code == 200
