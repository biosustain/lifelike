import pytest

from neo4japp.models import AppUser


@pytest.fixture(scope='function')
def test_user(session) -> AppUser:
    user = AppUser(
        id=200,
        username='test',
        email='test@***ARANGO_DB_NAME***.bio',
        password_hash='password',
        first_name='Jim',
        last_name='Melancholy'
    )
    session.add(user)
    session.flush()
    return user
