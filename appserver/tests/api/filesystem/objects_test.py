import hashlib
from urllib.parse import quote

import pytest

from neo4japp.models import AppUser, Files, Projects
from tests.api.filesystem.conftest import ParameterizedFile as TestFile, \
    ParameterizedAppUser as TestUser
from tests.helpers.api import generate_jwt_headers
from tests.helpers.assertions import assert_project_response, assert_file_response


@pytest.mark.parametrize(
    'file_in_project, user_with_project_roles, status_code, readable, writable, commentable', [
        # All of these test cases are for the many combinations of privilege options we have
        # in the file system (public flag, project privileges, parent folder privileges,
        # file privileges)

        # Parent folder + File privileges + Private file
        (TestFile(public=False, in_folder=True, user_roles_for_file=[
            'file-read',
        ]), TestUser([], []), 200, True, False, False),
        (TestFile(public=False, in_folder=True, user_roles_for_file=[
            'file-write',
        ]), TestUser([], []), 200, True, True, True),
        (TestFile(public=False, in_folder=True, user_roles_for_file=[
            'file-comment',
        ]), TestUser([], []), 200, True, False, True),
        (TestFile(public=False, in_folder=True, user_roles_for_file=[
            'file-read', 'file-write'
        ]), TestUser([], []), 200, True, True, True),
        (TestFile(public=False, in_folder=True, user_roles_for_file=[
            'file-write', 'file-comment'
        ]), TestUser([], []), 200, True, True, True),
        (TestFile(public=False, in_folder=True, user_roles_for_file=[
            'file-read', 'file-write', 'file-comment',
        ]), TestUser([], []), 200, True, True, True),

        # Parent folder + File privileges + Public file
        (TestFile(public=True, in_folder=True, user_roles_for_file=[
            'file-read',
        ]), TestUser([], []), 200, True, False, False),
        (TestFile(public=True, in_folder=True, user_roles_for_file=[
            'file-write',
        ]), TestUser([], []), 200, True, True, True),
        (TestFile(public=True, in_folder=True, user_roles_for_file=[
            'file-comment',
        ]), TestUser([], []), 200, True, False, True),
        (TestFile(public=True, in_folder=True, user_roles_for_file=[
            'file-read', 'file-write'
        ]), TestUser([], []), 200, True, True, True),
        (TestFile(public=True, in_folder=True, user_roles_for_file=[
            'file-write', 'file-comment'
        ]), TestUser([], []), 200, True, True, True),
        (TestFile(public=True, in_folder=True, user_roles_for_file=[
            'file-read', 'file-write', 'file-comment',
        ]), TestUser([], []), 200, True, True, True),

        # Parent folder + Parent folder privileges + Private file
        (TestFile(public=False, in_folder=True, user_roles_for_folder=[
            'file-read',
        ]), TestUser([], []), 200, True, False, False),
        (TestFile(public=False, in_folder=True, user_roles_for_folder=[
            'file-write',
        ]), TestUser([], []), 200, True, True, True),
        (TestFile(public=False, in_folder=True, user_roles_for_folder=[
            'file-comment',
        ]), TestUser([], []), 200, True, False, True),
        (TestFile(public=False, in_folder=True, user_roles_for_folder=[
            'file-read', 'file-write'
        ]), TestUser([], []), 200, True, True, True),
        (TestFile(public=False, in_folder=True, user_roles_for_folder=[
            'file-write', 'file-comment'
        ]), TestUser([], []), 200, True, True, True),
        (TestFile(public=False, in_folder=True, user_roles_for_folder=[
            'file-read', 'file-write', 'file-comment',
        ]), TestUser([], []), 200, True, True, True),

        # Parent folder + Parent folder privileges + Public file
        (TestFile(public=True, in_folder=True, user_roles_for_folder=[
            'file-read',
        ]), TestUser([], []), 200, True, False, False),
        (TestFile(public=True, in_folder=True, user_roles_for_folder=[
            'file-write',
        ]), TestUser([], []), 200, True, True, True),
        (TestFile(public=True, in_folder=True, user_roles_for_folder=[
            'file-comment',
        ]), TestUser([], []), 200, True, False, True),
        (TestFile(public=True, in_folder=True, user_roles_for_folder=[
            'file-read', 'file-write'
        ]), TestUser([], []), 200, True, True, True),
        (TestFile(public=True, in_folder=True, user_roles_for_folder=[
            'file-write', 'file-comment'
        ]), TestUser([], []), 200, True, True, True),
        (TestFile(public=True, in_folder=True, user_roles_for_folder=[
            'file-read', 'file-write', 'file-comment',
        ]), TestUser([], []), 200, True, True, True),

        # Parent folder + Parent folder privileges + File privileges + Private file
        # This is for handling combinations of privileges on files and their parent folders
        (TestFile(public=False, in_folder=True, user_roles_for_folder=[
            'file-read',
        ], user_roles_for_file=[
            'file-write'
        ]), TestUser([], []), 200, True, True, True),
        (TestFile(public=False, in_folder=True, user_roles_for_folder=[
            'file-write',
        ], user_roles_for_file=[
            'file-read'
        ]), TestUser([], []), 200, True, True, True),
        (TestFile(public=False, in_folder=True, user_roles_for_folder=[
            'file-read',
        ], user_roles_for_file=[
            'file-comment'
        ]), TestUser([], []), 200, True, False, True),
        (TestFile(public=False, in_folder=True, user_roles_for_folder=[
            'file-comment',
        ], user_roles_for_file=[
            'file-read'
        ]), TestUser([], []), 200, True, False, True),

        # No parent folder + App permissions + Private file
        (TestFile(public=False), TestUser([], []), 403, False, False, False),
        (TestFile(public=False), TestUser(['private-data-access'], []), 200, True, True, True),

        # No parent folder + App permissions + Public file
        (TestFile(public=True), TestUser([], []), 200, True, False, False),
        (TestFile(public=True), TestUser(['private-data-access'], []), 200, True, True, True),

        # No parent folder + Project permissions + Private file
        (TestFile(public=False), TestUser([], ['project-read']), 200, True, False, False),
        (TestFile(public=False), TestUser([], ['project-write']), 200, True, True, True),
        (TestFile(public=False), TestUser([], ['project-admin']), 200, True, True, True),
        (TestFile(public=False), TestUser([], ['project-write', 'project-admin']), 200, True, True,
         True),
        (TestFile(public=False), TestUser([], ['project-read', 'project-write']), 200, True, True,
         True),
        (TestFile(public=False), TestUser([], ['project-read', 'project-admin']), 200, True, True,
         True),
        (TestFile(public=False), TestUser([], ['project-read', 'project-write', 'project-admin']),
         200, True, True, True),

        # No parent folder + Project permissions + Public file
        (TestFile(public=True), TestUser([], ['project-read']), 200, True, False, False),
        (TestFile(public=True), TestUser([], ['project-write']), 200, True, True, True),
        (TestFile(public=True), TestUser([], ['project-admin']), 200, True, True, True),
        (TestFile(public=True), TestUser([], ['project-write', 'project-admin']), 200, True, True,
         True),
        (TestFile(public=True), TestUser([], ['project-read', 'project-write']), 200, True, True,
         True),
        (TestFile(public=True), TestUser([], ['project-read', 'project-admin']), 200, True, True,
         True),
        (TestFile(public=True), TestUser([], ['project-read', 'project-write', 'project-admin']),
         200, True, True, True),
    ],
    indirect=['file_in_project', 'user_with_project_roles'],
    ids=str,
)
def test_get_file(
        client,
        login_password: str,
        user_with_project_roles: AppUser,
        status_code: int,
        readable: bool,
        writable: bool,
        commentable: bool,
        project: Projects,
        file_in_project: Files):
    login_resp = client.login_as_user(user_with_project_roles.email, login_password)
    headers = generate_jwt_headers(login_resp['access_jwt'])

    resp = client.get(
        f'/filesystem/objects/{quote(file_in_project.hash_id)}',
        headers=headers,
        content_type='application/json'
    )

    assert resp.status_code == status_code

    if status_code == 200:
        resp_data = resp.get_json()
        resp_file = resp_data['result']
        assert_file_response(resp_file, file_in_project)
        assert_project_response(resp_file['project'], project)
        assert resp_file['privileges']['readable'] is readable
        assert resp_file['privileges']['writable'] is writable
        assert resp_file['privileges']['commentable'] is commentable


@pytest.mark.parametrize(
    'user_with_project_roles', [
        TestUser([], []),
    ],
    indirect=['user_with_project_roles'],
    ids=str,
)
def test_get_file_missing(
        client,
        login_password: str,
        user_with_project_roles: AppUser):
    login_resp = client.login_as_user(user_with_project_roles.email, login_password)
    headers = generate_jwt_headers(login_resp['access_jwt'])

    resp = client.get(
        f'/filesystem/objects/test_get_file_missing',
        headers=headers,
        content_type='application/json'
    )

    assert resp.status_code == 404


@pytest.mark.parametrize(
    'user_with_project_roles, status_code', [
        (TestUser([], []), 403),
        (TestUser(['private-data-access'], []), 200),
        (TestUser([], ['project-read']), 403),
        (TestUser([], ['project-write']), 200),
        (TestUser([], ['project-admin']), 200),
        (TestUser([], ['project-write', 'project-admin']), 200),
        (TestUser([], ['project-read', 'project-write']), 200),
        (TestUser([], ['project-read', 'project-admin']), 200),
        (TestUser([], ['project-read', 'project-write', 'project-admin']), 200),
    ],
    indirect=['user_with_project_roles'],
    ids=str
)
@pytest.mark.parametrize(
    'file_in_project', [
        TestFile(public=False),
        TestFile(public=True),
    ],
    indirect=['file_in_project'],
    ids=str,
)
def test_patch_file_permitted(
        request,
        session,
        client,
        login_password: str,
        user_with_project_roles: AppUser,
        status_code: int,
        file_in_project: Files):
    login_resp = client.login_as_user(user_with_project_roles.email, login_password)
    headers = generate_jwt_headers(login_resp['access_jwt'])

    original_filename = session.query(Files.filename) \
        .filter(Files.id == file_in_project.id) \
        .one()[0]
    new_filename = hashlib.sha1(request.node.name.encode('utf-8')).hexdigest()
    assert original_filename != new_filename

    resp = client.patch(
        f'/filesystem/objects/{quote(file_in_project.hash_id)}',
        headers=headers,
        json={
            'filename': new_filename,
        },
    )

    assert resp.status_code == status_code

    # Let's make sure the database did or did not change!
    updated_filename = session.query(Files.filename) \
        .filter(Files.id == file_in_project.id) \
        .one()[0]
    if status_code == 200:
        assert updated_filename == new_filename
    else:
        assert updated_filename != new_filename


@pytest.mark.parametrize(
    'user_with_project_roles', [
        TestUser([], []),
    ],
    indirect=['user_with_project_roles'],
    ids=str,
)
def test_patch_file_missing(
        client,
        login_password: str,
        user_with_project_roles: AppUser):
    login_resp = client.login_as_user(user_with_project_roles.email, login_password)
    headers = generate_jwt_headers(login_resp['access_jwt'])

    resp = client.patch(
        f'/filesystem/objects/test_get_file_missing',
        headers=headers,
        json={
            'filename': 'whatever, man',
        },
    )

    assert resp.status_code == 404


@pytest.mark.parametrize(
    'user_with_project_roles, status_code', [
        (TestUser([], []), 403),
        (TestUser(['private-data-access'], []), 200),
        (TestUser([], ['project-read']), 403),
        (TestUser([], ['project-write']), 200),
        (TestUser([], ['project-admin']), 200),
        (TestUser([], ['project-write', 'project-admin']), 200),
        (TestUser([], ['project-read', 'project-write']), 200),
        (TestUser([], ['project-read', 'project-admin']), 200),
        (TestUser([], ['project-read', 'project-write', 'project-admin']), 200),
    ],
    indirect=['user_with_project_roles'],
    ids=str
)
@pytest.mark.parametrize(
    'file_in_project', [
        TestFile(public=False),
        TestFile(public=True),
    ],
    indirect=['file_in_project'],
    ids=str,
)
def test_bulk_patch_files_permitted(
        request,
        session,
        client,
        login_password: str,
        user_with_project_roles: AppUser,
        status_code: int,
        file_in_project: Files):
    login_resp = client.login_as_user(user_with_project_roles.email, login_password)
    headers = generate_jwt_headers(login_resp['access_jwt'])

    original_filename = session.query(Files.filename) \
        .filter(Files.id == file_in_project.id) \
        .one()[0]
    new_filename = hashlib.sha1(request.node.name.encode('utf-8')).hexdigest()
    assert original_filename != new_filename

    resp = client.patch(
        f'/filesystem/objects',
        headers=headers,
        json={
            'hashIds': [
                file_in_project.hash_id,
            ],
            'filename': new_filename,
        },
    )

    assert resp.status_code == status_code

    updated_filename = session.query(Files.filename) \
        .filter(Files.id == file_in_project.id) \
        .one()[0]
    if status_code == 200:
        assert updated_filename == new_filename
    else:
        assert updated_filename != new_filename


@pytest.mark.parametrize(
    'user_with_project_roles', [
        TestUser([], []),
    ],
    indirect=['user_with_project_roles'],
    ids=str,
)
def test_bulk_patch_files_missing(
        client,
        login_password: str,
        user_with_project_roles: AppUser):
    login_resp = client.login_as_user(user_with_project_roles.email, login_password)
    headers = generate_jwt_headers(login_resp['access_jwt'])

    resp = client.patch(
        f'/filesystem/objects',
        headers=headers,
        json={
            'hashIds': [
                'test_bulk_patch_files_missing',
            ],
            'filename': 'punk isn\'t dead.gif',
        },
    )

    assert resp.status_code == 200

    resp_data = resp.get_json()
    assert resp_data['mapping'] == dict()
    assert resp_data['missing'] == ['test_bulk_patch_files_missing']
