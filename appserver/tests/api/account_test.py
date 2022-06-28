import json
import re
from types import SimpleNamespace

import pytest
import responses

from neo4japp.models import AppUser
from tests.helpers.api import generate_jwt_headers


@pytest.fixture(scope='function')
def mock_users(session, fix_user_role):
    mock_users = [
        'Yoda', 'Clones', 'Mandolorian', 'SithLord', 'Luke',
        'Leia', 'Rey', 'Fin', 'BB8', 'r2d2', 'Kylo']
    users = [
        AppUser(
            username=u,
            first_name=u,
            last_name=u,
            email=f'{u}.lifelike.bio',
            subject=f'{u}.lifelike.bio'
        ) for u in mock_users]
    for u in users:
        u.roles.append(fix_user_role)
    session.add_all(users)
    session.flush()
    return users


@pytest.fixture(scope='function')
def mocked_lmdb_open(monkeypatch):
    def lmdb_open(*args, **kwargs):
        return SimpleNamespace(
            open_db=lambda *args, **kwargs: None,
            close=lambda *args, **kwargs: None,
            begin=lambda *args, **kwargs: SimpleNamespace(
                cursor=lambda *args, **kwargs: SimpleNamespace(
                    getmulti=lambda *args, **kwargs: [])))
    monkeypatch.setattr('lmdb.open', lmdb_open)


def test_admin_can_create_user(client, fix_admin_user, mocked_responses, mocked_lmdb_open):
    login_resp = client.login_as_user(fix_admin_user.email, 'password')
    headers = generate_jwt_headers(login_resp['accessToken']['token'])

    # Mocked responses from pdfparser
    mocked_responses.add(
        responses.POST,
        re.compile('.+/token/rect/.+'),
        status=201,
        content_type='application/json',
        json={'pages': []},
    )

    response = client.post(
        '/accounts/',
        headers=headers,
        data=json.dumps({
            'username': 'xXxBabyYodaxXx',
            'email': 'babyyodes858@lifelike.bio',
            'firstName': 'baby',
            'lastName': 'yoda',
            'roles': 'admin',
            'password': 'iluvmando',
            'createdByAdmin': True
        }),
        content_type='application/json'
    )

    assert response.status_code == 200


def test_nonadmin_cannot_create_user(client, test_user):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_jwt_headers(login_resp['accessToken']['token'])

    response = client.post(
        '/accounts/',
        headers=headers,
        data=json.dumps({
            'username': 'xXxBabyYodaxXx',
            'email': 'babyyodes858@lifelike.bio',
            'firstName': 'baby',
            'lastName': 'yoda',
            'roles': 'admin',
            'password': 'iluvmando',
        }),
        content_type='application/json'
    )

    assert response.status_code == 400


def test_admin_can_get_all_users(client, mock_users, fix_admin_user):
    login_resp = client.login_as_user(fix_admin_user.email, 'password')
    headers = generate_jwt_headers(login_resp['accessToken']['token'])

    response = client.get(
        '/accounts/',
        headers=headers,
        content_type='application/json')

    assert response.status_code == 200
    result = response.get_json()
    # Add 1 to include the current user
    assert int(result['total']) == len(mock_users) + 1


def test_admin_can_get_any_user(client, mock_users, fix_admin_user):
    login_resp = client.login_as_user(fix_admin_user.email, 'password')
    headers = generate_jwt_headers(login_resp['accessToken']['token'])

    user = mock_users[0]
    response = client.get(
        f'/accounts/{user.hash_id}',
        headers=headers,
        content_type='application/json'
    )
    assert response.status_code == 200
    result = response.get_json()
    assert int(result['total']) == 1


def test_nonadmin_can_only_get_self(client, mock_users, test_user):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_jwt_headers(login_resp['accessToken']['token'])

    response = client.get(
        '/accounts/',
        headers=headers,
        content_type='application/json')

    assert response.status_code == 200
    result = response.get_json()
    assert int(result['total']) == 1
    assert result['results'][0]['email'] == test_user.email

    response = client.get(
        f'/accounts/{test_user.hash_id}',
        headers=headers,
        content_type='application/json'
    )

    assert response.status_code == 200
    result = response.get_json()
    assert int(result['total']) == 1
    assert result['results'][0]['email'] == test_user.email

    response = client.get(
        f'/accounts/{mock_users[1].hash_id}',
        headers=headers,
        content_type='application/json'
    )

    assert response.status_code == 400


@pytest.mark.parametrize('attribute, value, is_editable', [
    ('firstName', 'fresh', True),
    ('lastName', 'smith', True),
    ('username', 'false@lifelike.bio', True),
    ('email', 'email@lifelike.bio', False),
])
def test_can_update_only_allowed_attributes(client, test_user, attribute, value, is_editable):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_jwt_headers(login_resp['accessToken']['token'])
    response = client.put(
        f'/accounts/{test_user.hash_id}',
        headers=headers,
        data=json.dumps({attribute: value}),
        content_type='application/json'
    )

    assert response.status_code == 204

    response = client.get(
        f'/accounts/{test_user.hash_id}', headers=headers, content_type='application/json')
    result = response.get_json()['results'][0]

    # Only values specified in the schema can be edited.
    if is_editable:
        assert result[attribute] == value
    else:
        assert result[attribute] != value


def test_can_update_password(client, test_user):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_jwt_headers(login_resp['accessToken']['token'])
    response = client.put(
        f'/accounts/{test_user.hash_id}/change-password',
        headers=headers,
        data=json.dumps({'password': 'password', 'newPassword': 'new_password'}),
        content_type='application/json'
    )

    assert response.status_code == 204
    login_resp = client.login_as_user(test_user.email, 'new_password')
    headers = generate_jwt_headers(login_resp['accessToken']['token'])
    assert headers


@pytest.mark.skip(reason="TODO: Skip until we implement filtering for endpoints")
@pytest.mark.parametrize('username', [
    ('Yoda'),
    ('Clones'),
    ('BB8')
])
def test_can_filter_users(client, mock_users, auth_token_header, username):
    response = client.get(
        f'/accounts/?fields=username&filters={username}',
        headers=auth_token_header,
        content_type='application/json')
    assert response.status_code == 200
    response = response.get_json()
    users = response['result']
    assert len(users) == 1
