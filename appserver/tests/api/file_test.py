import os
import pytest
import json
from io import BytesIO
from werkzeug.datastructures import FileStorage


def generate_headers(jwt_token):
    return {'Authorization': f'Bearer {jwt_token}'}


def test_user_can_delete_own_pdf(client, fix_project, test_user_with_pdf, test_user):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])
    file_id = test_user_with_pdf.id
    delete_resp = client.delete(
        f'/projects/{fix_project.project_name}/files',
        data=json.dumps({file_id: file_id}),
        headers=headers,
        content_type='application/json',
    )

    assert delete_resp.status_code == 200


def test_user_cannot_delete_pdf_without_permission(
        client, fix_project, test_user_with_pdf, test_user_2):
    login_resp = client.login_as_user(test_user_2.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])
    file_id = test_user_with_pdf.id
    delete_resp = client.delete(
        f'/projects/{fix_project.project_name}/files',
        data=json.dumps({file_id: file_id}),
        headers=headers,
        content_type='application/json',
    )
    assert delete_resp.status_code == 400


def test_admin_can_delete_pdf_without_permission(
        client, test_user_with_pdf, fix_project, fix_api_owner):
    login_resp = client.login_as_user(fix_api_owner.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])
    file_id = test_user_with_pdf.id
    delete_resp = client.delete(
        f'/projects/{fix_project.project_name}/files',
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

    def mockannotate(filename, pdf, annotation_method):
        """ Mocks out the 'annotate' function in the module
        since we don't care about the annotation process """
        return dict()

    def mock_extract_doi(pdf_content, file_id, filename):
        """ Mocks out the extract doi function in the module """
        return None

    monkeypatch.setattr(files, 'annotate', mockannotate)
    monkeypatch.setattr(files, 'extract_doi', mock_extract_doi)
    mock_pdf = BytesIO(json.dumps(dict()).encode('utf-8'))

    resp = client.post(
        f'/projects/{fix_project.project_name}/files',
        headers=headers,
        data={
            'fileInput': (mock_pdf, 'mock.pdf'),
            'filename': 'mock.pdf',
            'directoryId': fix_directory.id,
            'annotationMethod': 'Rules Based'
        },
        content_type='multipart/form-data'
    )

    assert resp.status_code == 200


def test_cannot_upload_if_no_write_permission(
        monkeypatch, client, test_user, test_user_2, fix_project, fix_directory):
    from neo4japp.blueprints import files

    login_resp = client.login_as_user(test_user_2.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])

    def mockannotate(filename, pdf, annotation_method):
        """ Mocks out the 'annotate' function in the module
        since we don't care about the annotation process """
        return dict()

    monkeypatch.setattr(files, 'annotate', mockannotate)
    mock_pdf = BytesIO(json.dumps(dict()).encode('utf-8'))

    resp = client.post(
        f'/projects/{fix_project.project_name}/files',
        headers=headers,
        data={
            'fileInput': (mock_pdf, 'mock.pdf'),
            'filename': 'mock.pdf',
            'directoryId': fix_directory.id,
            'annotationMethod': 'Rules Based'
        },
        content_type='multipart/form-data'
    )

    assert resp.status_code == 400


def test_can_view_all_files_in_project(monkeypatch, client, test_user, fix_project, fix_directory):
    from neo4japp.blueprints import files

    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])

    def mockannotate(filename, pdf, annotation_method):
        """ Mocks out the 'annotate' function in the module
        since we don't care about the annotation process """
        return dict()

    def mock_extract_doi(pdf_content, file_id, filename):
        """ Mocks out the extract doi function in the module """
        return None

    monkeypatch.setattr(files, 'annotate', mockannotate)
    monkeypatch.setattr(files, 'extract_doi', mock_extract_doi)
    mock_pdf = BytesIO(json.dumps(dict()).encode('utf-8'))

    resp = client.post(
        f'/projects/{fix_project.project_name}/files',
        headers=headers,
        data={
            'fileInput': (mock_pdf, 'mock.pdf'),
            'filename': 'mock.pdf',
            'directoryId': fix_directory.id,
            'annotationMethod': 'Rules Based'
        },
        content_type='multipart/form-data'
    )

    assert resp.status_code == 200
    resp = client.get(f'/projects/{fix_project.project_name}/files', headers=headers)
    assert resp.status_code == 200
    filename = resp.get_json()['files'].pop()['filename']
    assert filename == 'mock.pdf'


def test_can_get_pdf(client, test_user, test_user_with_pdf, fix_project):
    from neo4japp.blueprints import files

    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])

    file_id = test_user_with_pdf.file_id

    resp = client.get(f'/projects/{fix_project.project_name}/files/{file_id}', headers=headers)

    assert resp.status_code == 200


@pytest.mark.skip('Does this API work??? TODO: Check if return makes sense')
def test_can_get_pdf_annotations(
        monkeypatch, client, test_user, test_user_with_pdf, fix_project):
    from neo4japp.blueprints import files

    def mock_map_annotations_to_correct_format(unformatted_annotations):
        """ Mocks out the formatter in the function
        since we don't care about the annotation process """
        return []

    monkeypatch.setattr(
        files,
        'map_annotations_to_correct_format',
        mock_map_annotations_to_correct_format
    )

    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])

    file_id = test_user_with_pdf.file_id

    resp = client.get(
        f'/projects/{fix_project.project_name}/files/{file_id}/annotations',
        headers=headers
    )

    assert resp.status_code == 200


CUSTOM_ANNOTATION_1 = {
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
        'primaryLink': '',
        'includeGlobally': False
    },
}

CUSTOM_ANNOTATION_2 = {
    'pageNumber': 1,
    'keywords': ['gyrA'],
    'rects': [[0.5, 0.6, 0.7, 0.8]],
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
        'primaryLink': '',
        'includeGlobally': False
    },
}


def test_user_can_add_custom_annotation(client, test_user, test_user_with_pdf, fix_project):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])
    file_id = test_user_with_pdf.file_id

    resp = client.patch(
        f'/projects/{fix_project.project_name}/files/{file_id}/annotations/add',
        headers=headers,
        data=json.dumps({
            'annotation': CUSTOM_ANNOTATION_1,
            'annotateAll': False
        }),
        content_type='application/json',
    )

    assert resp.status_code == 200
    assert 'uuid' in resp.get_json()[0]


def test_user_can_remove_custom_annotation(client, test_user, test_user_with_pdf, fix_project):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])
    file_id = test_user_with_pdf.file_id

    add_resp = client.patch(
        f'/projects/{fix_project.project_name}/files/{file_id}/annotations/add',
        headers=headers,
        data=json.dumps({
            'annotation': CUSTOM_ANNOTATION_1,
            'annotateAll': False
        }),
        content_type='application/json',
    )

    uuid = add_resp.get_json()[0]['uuid']

    remove_resp = client.patch(
        f'/projects/{fix_project.project_name}/files/{file_id}/annotations/remove',
        headers=headers,
        data=json.dumps({
            'uuid': uuid,
            'removeAll': False
        }),
        content_type='application/json',
    )

    assert remove_resp.status_code == 200
    assert uuid in remove_resp.get_json()


def test_user_can_remove_matching_custom_annotations(
        client, test_user, test_user_with_pdf, fix_project):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])
    file_id = test_user_with_pdf.file_id

    add_resp_1 = client.patch(
        f'/projects/{fix_project.project_name}/files/{file_id}/annotations/add',
        headers=headers,
        data=json.dumps({
            'annotation': CUSTOM_ANNOTATION_1,
            'annotateAll': False
        }),
        content_type='application/json',
    )

    uuid_1 = add_resp_1.get_json()[0]['uuid']

    add_resp_2 = client.patch(
        f'/projects/{fix_project.project_name}/files/{file_id}/annotations/add',
        headers=headers,
        data=json.dumps({
            'annotation': CUSTOM_ANNOTATION_2,
            'annotateAll': False
        }),
        content_type='application/json',
    )

    uuid_2 = add_resp_2.get_json()[0]['uuid']

    remove_resp = client.patch(
        f'/projects/{fix_project.project_name}/files/{file_id}/annotations/remove',
        headers=headers,
        data=json.dumps({
            'uuid': uuid_2,
            'removeAll': True
        }),
        content_type='application/json',
    )

    assert remove_resp.status_code == 200
    assert uuid_1 in remove_resp.get_json()
    assert uuid_2 in remove_resp.get_json()


def test_can_delete_files(client, test_user, test_user_with_pdf, fix_project):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])
    file_id = test_user_with_pdf.file_id
    resp = client.delete(
        f'/projects/{fix_project.project_name}/files',
        headers=headers,
        data=json.dumps({file_id: file_id}),
        content_type='application/json',
    )

    assert resp.status_code == 200


def test_user_can_remove_annotation_exclusion(client, test_user, test_user_with_pdf, fix_project):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])
    file_id = test_user_with_pdf.file_id

    client.patch(
        f'/projects/{fix_project.project_name}/files/{file_id}/annotations/add_annotation_exclusion',  # noqa
        headers=headers,
        data=json.dumps({
            'id': 'id',
            'idHyperlink': 'link',
            'text': 'text',
            'type': 'type',
            'rects': [],
            'pageNumber': 1,
            'reason': 'reason',
            'comment': 'comment',
            'excludeGlobally': False
        }),
        content_type='application/json',
    )

    remove_exc_resp = client.patch(
        f'/projects/{fix_project.project_name}/files/{file_id}/annotations/remove_annotation_exclusion',  # noqa
        headers=headers,
        data=json.dumps({
            'type': 'type',
            'text': 'text'
        }),
        content_type='application/json',
    )

    assert remove_exc_resp.status_code == 200
