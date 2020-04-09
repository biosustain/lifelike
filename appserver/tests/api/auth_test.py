import pytest
import json
import jwt
from datetime import datetime, timedelta
from neo4japp.models import AppUser


def user_factory(uid):
    return dict(
        username=f'AppUser-{uid}',
        firstName=f'firstname-{uid}',
        lastName=f'lastname-{uid}',
        email=f'appuser-{uid}@***ARANGO_DB_NAME***.bio',
        roles=['user'],
    )


@pytest.mark.parametrize('password, login_password', [
    ('correct password', 'correct password'),
    ('correct password', 'incorrect password'),
])
def test_can_authenticate_user(client, session, password, login_password):

    user_data = user_factory(1)
    user = AppUser().from_dict(user_data)
    user.set_password(password)
    session.add(user)
    session.flush()

    data = json.dumps(dict(email=user.email, password=login_password))

    response = client.post(
        '/auth/login',
        data=data,
        content_type='application/json',
    )

    if password == login_password:
        assert response.status_code == 200
    else:
        assert response.status_code == 401
