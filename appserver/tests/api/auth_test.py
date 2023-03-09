import json
from http import HTTPStatus

import pytest

from neo4japp.models import AppUser


def user_factory(uid):
    return {
        "username": f"AppUser-{uid}",
        "firstName": f"firstname-{uid}",
        "lastName": f"lastname-{uid}",
        "email": f"appuser-{uid}@***ARANGO_DB_NAME***.bio",
        "subject": f"appuser-{uid}@***ARANGO_DB_NAME***.bio",
        "roles": ["user"],
        "failedLoginCount": 0,
    }


@pytest.mark.parametrize(
    "password, login_password",
    [
        ("correct password", "correct password"),
        ("correct password", "incorrect password"),
    ],
)
def test_can_authenticate_user(client, session, password, login_password):
    user_data = user_factory(1)
    user = AppUser().from_dict(user_data)
    user.set_password(password)
    session.add(user)
    session.flush()

    data = json.dumps({"email": user.email, "password": login_password})

    response = client.post(
        "/auth/login",
        data=data,
        content_type="application/json",
    )

    if password == login_password:
        assert response.status_code == HTTPStatus.OK
    else:
        assert response.status_code == HTTPStatus.UNAUTHORIZED


def test_can_authenticate_with_auth_token(client, session):
    user_data = user_factory(2)
    user = AppUser().from_dict(user_data)
    user.set_password("password")
    session.add(user)
    session.flush()

    data = json.dumps({"email": user.email, "password": "password"})

    response = client.post(
        "/auth/login",
        data=data,
        content_type="application/json",
    )

    response_data = response.get_json()
    refresh_jwt = response_data["accessToken"]["token"]
    headers = {"Authorization": f"Bearer {refresh_jwt}"}

    response = client.get(
        "/accounts/",
        headers=headers,
    )

    assert response.status_code == 200
