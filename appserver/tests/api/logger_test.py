from http import HTTPStatus

import pytest
import json


def generate_headers(jwt_token):
    return {'Authorization': f'Bearer {jwt_token}'}


@pytest.mark.parametrize('payload', (
    dict(
        title='err', message='', detail=None, transactionId='test',
        url='', label='', expected=''),
    dict(
        title=None, message='', detail=None, transactionId='test',
        url='', label='', expected=False),
))
def test_logging_invalid_schemas(client, test_user, payload):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['accessToken']['token'])

    resp = client.post(
        f'/logging/',
        data=json.dumps(payload),
        headers=headers,
        content_type='application/json'
    )
    assert resp.status_code == HTTPStatus.BAD_REQUEST


@pytest.mark.parametrize('payload', (
    dict(
        title='err', message='', detail=None, transactionId='test',
        url='', label='', expected=True),
    dict(
        title='err', message='', detail='des', transactionId='test',
        url='', label='', expected=True),
))
def test_logging_valid_schemas(client, test_user, payload):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['accessToken']['token'])

    resp = client.post(
        f'/logging/',
        data=json.dumps(payload),
        headers=headers,
        content_type='application/json'
    )
    assert resp.status_code == HTTPStatus.OK
