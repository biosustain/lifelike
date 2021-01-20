import datetime
import uuid
from typing import Dict, Optional
from urllib.parse import quote

import pytest
from dateutil.parser import parse

from neo4japp.models import Files, Projects, AppUser, FileContent, projects_collaborator_role
from neo4japp.services import AccountService
from neo4japp.services.file_types.providers import DirectoryTypeProvider, MapTypeProvider


def random_test_string():
    return str(uuid.uuid4())


def generate_headers(jwt_token):
    return {'Authorization': f'Bearer {jwt_token}'}


def assert_datetime_response(actual: str, expected: datetime.datetime):
    if actual is None or expected is None:
        return actual == expected
    else:
        assert parse(actual) == expected


def assert_user_response(actual: Optional[Dict], expected: Optional[AppUser]):
    if actual is None or expected is None:
        return actual == expected
    else:
        assert actual['hashId'] == expected.hash_id


def assert_project_response(actual: Optional[Dict], expected: Optional[Projects]):
    if actual is None or expected is None:
        return actual == expected
    else:
        assert actual['hashId'] == expected.hash_id
        assert actual['name'] == expected.name
        assert actual['description'] == expected.description
        assert_datetime_response(actual['creationDate'], expected.creation_date)
        assert_datetime_response(actual['modifiedDate'], expected.modified_date)


def assert_file_response(actual: Optional[Dict], expected: Optional[Files]):
    if actual is None or expected is None:
        return actual == expected
    else:
        assert actual['hashId'] == expected.hash_id
        assert actual['filename'] == expected.filename
        assert actual['description'] == expected.description
        assert actual['doi'] == expected.doi
        assert actual['uploadUrl'] == expected.upload_url
        assert actual['public'] == expected.public
        assert_datetime_response(actual['annotationsDate'], expected.annotations_date)
        assert_datetime_response(actual['creationDate'], expected.creation_date)
        assert_datetime_response(actual['modifiedDate'], expected.modified_date)
        assert_datetime_response(actual['recyclingDate'], expected.recycling_date)
        assert_file_response(actual['parent'], expected.parent)
        assert_user_response(actual['user'], expected.user)


# ========================================
# Fixtures
# ========================================

@pytest.fixture(scope='function')
def login_password() -> str:
    return random_test_string()


@pytest.fixture(scope='function')
def admin_user(
        session,
        account_user: AccountService,
        login_password: str) -> AppUser:
    user = AppUser(
        username=random_test_string(),
        email=f'{random_test_string()}@***ARANGO_DB_NAME***.bio',
        first_name=random_test_string(),
        last_name=random_test_string(),
    )
    user.set_password(login_password)
    user.roles.extend([
        account_user.get_or_create_role('admin'),
    ])
    session.add(user)
    session.flush()
    return user


@pytest.fixture(scope='function')
def private_data_access_user(
        session,
        account_user: AccountService,
        login_password: str) -> AppUser:
    user = AppUser(
        username=random_test_string(),
        email=f'{random_test_string()}@***ARANGO_DB_NAME***.bio',
        first_name=random_test_string(),
        last_name=random_test_string(),
    )
    user.set_password(login_password)
    user.roles.extend([
        account_user.get_or_create_role('private-data-access'),
    ])
    session.add(user)
    session.flush()
    return user


@pytest.fixture(scope='function')
def project_admin_user0(
        session,
        login_password: str) -> AppUser:
    user = AppUser(
        username=random_test_string(),
        email=f'{random_test_string()}@***ARANGO_DB_NAME***.bio',
        first_name=random_test_string(),
        last_name=random_test_string(),
    )
    user.set_password(login_password)
    session.add(user)
    session.flush()
    return user


@pytest.fixture(scope='function')
def project_admin_user(
        session,
        account_user: AccountService,
        project_admin_user0: AppUser,
        project: Projects) -> AppUser:
    session.execute(
        projects_collaborator_role.insert(),
        [{
            'appuser_id': project_admin_user0.id,
            'app_role_id': account_user.get_or_create_role('project-admin').id,
            'projects_id': project.id,
        }]
    )
    session.flush()
    return project_admin_user0


@pytest.fixture(scope='function')
def project_write_only_user(
        session,
        account_user: AccountService,
        login_password: str,
        project: Projects) -> AppUser:
    user = AppUser(
        username=random_test_string(),
        email=f'{random_test_string()}@***ARANGO_DB_NAME***.bio',
        first_name=random_test_string(),
        last_name=random_test_string(),
    )
    user.set_password(login_password)
    session.add(user)
    session.flush()
    session.execute(
        projects_collaborator_role.insert(),
        [{
            'appuser_id': user.id,
            'app_role_id': account_user.get_or_create_role('project-write').id,
            'projects_id': project.id,
        }]
    )
    session.flush()
    return user


@pytest.fixture(scope='function')
def project_read_write_user(
        session,
        account_user: AccountService,
        login_password: str,
        project: Projects) -> AppUser:
    user = AppUser(
        username=random_test_string(),
        email=f'{random_test_string()}@***ARANGO_DB_NAME***.bio',
        first_name=random_test_string(),
        last_name=random_test_string(),
    )
    user.set_password(login_password)
    session.add(user)
    session.flush()
    session.execute(
        projects_collaborator_role.insert(),
        [{
            'appuser_id': user.id,
            'app_role_id': account_user.get_or_create_role('project-read').id,
            'projects_id': project.id,
        }, {
            'appuser_id': user.id,
            'app_role_id': account_user.get_or_create_role('project-write').id,
            'projects_id': project.id,
        }]
    )
    session.flush()
    return user


@pytest.fixture(scope='function')
def project_read_user(
        session,
        account_user: AccountService,
        login_password: str,
        project: Projects) -> AppUser:
    user = AppUser(
        username=random_test_string(),
        email=f'{random_test_string()}@***ARANGO_DB_NAME***.bio',
        first_name=random_test_string(),
        last_name=random_test_string(),
    )
    user.set_password(login_password)
    session.add(user)
    session.flush()
    session.execute(
        projects_collaborator_role.insert(),
        [{
            'appuser_id': user.id,
            'app_role_id': account_user.get_or_create_role('project-read').id,
            'projects_id': project.id,
        }]
    )
    session.flush()
    return user


@pytest.fixture(scope='function')
def non_project_user(
        session,
        login_password: str) -> AppUser:
    user = AppUser(
        username=random_test_string(),
        email=f'{random_test_string()}@***ARANGO_DB_NAME***.bio',
        first_name=random_test_string(),
        last_name=random_test_string(),
    )
    user.set_password(login_password)
    session.add(user)
    session.flush()
    return user


@pytest.fixture(scope='function')
def project(
        session,
        project_admin_user0: AppUser) -> Projects:
    ***ARANGO_USERNAME***_dir = Files(
        mime_type=DirectoryTypeProvider.MIME_TYPE,
        filename='/',
        user=project_admin_user0,
    )
    project = Projects(
        name=random_test_string(),
        description=random_test_string(),
        ***ARANGO_USERNAME***=***ARANGO_USERNAME***_dir,
    )
    session.add(***ARANGO_USERNAME***_dir)
    session.add(project)
    session.flush()
    return project


@pytest.fixture(scope='function')
def map_in_project(
        session,
        project: Projects,
        project_admin_user: AppUser) -> Files:
    content = FileContent()
    content.raw_file_utf8 = '{}'
    file = Files(
        mime_type=MapTypeProvider.MIME_TYPE,
        filename=random_test_string(),
        description=random_test_string(),
        user=project_admin_user,
        content=content,
        parent=project.***ARANGO_USERNAME***,
    )
    session.add(content)
    session.add(file)
    session.flush()
    return file


# ========================================
# Tests
# ========================================


def test_get_file(
        client,
        login_password: str,
        project_admin_user: AppUser,
        project: Projects,
        map_in_project: Files):
    login_resp = client.login_as_user(project_admin_user.email, login_password)
    headers = generate_headers(login_resp['access_jwt'])

    resp = client.get(
        f'/filesystem/objects/{quote(map_in_project.hash_id)}',
        headers=headers,
        content_type='application/json'
    )

    assert resp.status_code == 200

    resp_data = resp.get_json()
    resp_file = resp_data['result']
    assert_file_response(resp_file, map_in_project)
    assert_project_response(resp_file['project'], project)
    assert resp_file['privileges']['readable'] is True
    assert resp_file['privileges']['writable'] is True
    assert resp_file['privileges']['commentable'] is True


# Privilege
# ----------------------------------------


# User with project-read
def test_project_read_user_privileges(
        client,
        login_password: str,
        project_read_user: AppUser,
        map_in_project: Files):
    login_resp = client.login_as_user(project_read_user.email, login_password)
    headers = generate_headers(login_resp['access_jwt'])

    resp = client.get(
        f'/filesystem/objects/{quote(map_in_project.hash_id)}',
        headers=headers,
        content_type='application/json'
    )

    assert resp.status_code == 200

    resp_data = resp.get_json()
    resp_file = resp_data['result']
    assert resp_file['privileges']['readable'] is True
    assert resp_file['privileges']['writable'] is False
    assert resp_file['privileges']['commentable'] is False


# User with project-write
def test_write_only_user_privileges(
        client,
        login_password: str,
        project_write_only_user: AppUser,
        map_in_project: Files):
    login_resp = client.login_as_user(project_write_only_user.email, login_password)
    headers = generate_headers(login_resp['access_jwt'])

    resp = client.get(
        f'/filesystem/objects/{quote(map_in_project.hash_id)}',
        headers=headers,
        content_type='application/json'
    )

    assert resp.status_code == 200

    resp_data = resp.get_json()
    resp_file = resp_data['result']
    assert resp_file['privileges']['readable'] is True
    assert resp_file['privileges']['writable'] is True
    assert resp_file['privileges']['commentable'] is True


# User with project-read + project-write
def test_project_read_write_user_privileges(
        client,
        login_password: str,
        project_read_write_user: AppUser,
        map_in_project: Files):
    login_resp = client.login_as_user(project_read_write_user.email, login_password)
    headers = generate_headers(login_resp['access_jwt'])

    resp = client.get(
        f'/filesystem/objects/{quote(map_in_project.hash_id)}',
        headers=headers,
        content_type='application/json'
    )

    assert resp.status_code == 200

    resp_data = resp.get_json()
    resp_file = resp_data['result']
    assert resp_file['privileges']['readable'] is True
    assert resp_file['privileges']['writable'] is True
    assert resp_file['privileges']['commentable'] is True


# User with project-admin
def test_project_admin_user_privileges(
        client,
        login_password: str,
        project_admin_user: AppUser,
        map_in_project: Files):
    login_resp = client.login_as_user(project_admin_user.email, login_password)
    headers = generate_headers(login_resp['access_jwt'])

    resp = client.get(
        f'/filesystem/objects/{quote(map_in_project.hash_id)}',
        headers=headers,
        content_type='application/json'
    )

    assert resp.status_code == 200

    resp_data = resp.get_json()
    resp_file = resp_data['result']
    assert resp_file['privileges']['readable'] is True
    assert resp_file['privileges']['writable'] is True
    assert resp_file['privileges']['commentable'] is True


# User with private-data-access
def test_private_data_access_user(
        client,
        login_password: str,
        private_data_access_user: AppUser,
        map_in_project: Files):
    login_resp = client.login_as_user(private_data_access_user.email, login_password)
    headers = generate_headers(login_resp['access_jwt'])

    resp = client.get(
        f'/filesystem/objects/{quote(map_in_project.hash_id)}',
        headers=headers,
        content_type='application/json'
    )

    assert resp.status_code == 200

    resp_data = resp.get_json()
    resp_file = resp_data['result']
    assert resp_file['privileges']['readable'] is True
    assert resp_file['privileges']['writable'] is True
    assert resp_file['privileges']['commentable'] is True


# User with NO project permissions
def test_non_project_user_privileges(
        client,
        login_password: str,
        non_project_user: AppUser,
        map_in_project: Files):
    login_resp = client.login_as_user(non_project_user.email, login_password)
    headers = generate_headers(login_resp['access_jwt'])

    resp = client.get(
        f'/filesystem/objects/{quote(map_in_project.hash_id)}',
        headers=headers,
        content_type='application/json'
    )

    assert resp.status_code == 403
