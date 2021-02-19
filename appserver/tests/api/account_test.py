import pytest
from neo4japp.models import AppUser
from tests.helpers.api import generate_jwt_headers


@pytest.fixture
def auth_token_header(client, test_user):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_jwt_headers(login_resp['accessToken']['token'])
    return headers


@pytest.fixture
def mock_users(session):
    mock_users = [
        'Yoda', 'Clones', 'Mandolorian', 'SithLord', 'Luke',
        'Leia', 'Rey', 'Fin', 'BB8', 'r2d2', 'Kylo']
    users = [
        AppUser(
            username=u,
            first_name=u,
            last_name=u,
            email=f'{u}.***ARANGO_DB_NAME***.bio'
        ) for u in mock_users]
    session.add_all(users)
    session.flush()
    return users


def test_can_get_users(client, mock_users, auth_token_header):
    response = client.get(
        '/accounts/',
        headers=auth_token_header,
        content_type='application/json')
    assert response.status_code == 200


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
