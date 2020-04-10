import json
from datetime import date
import pytest

from neo4japp.models import AppUser, Project


@pytest.fixture(scope='function')
def fix_owner(session) -> AppUser:
    user = AppUser(
        id=100,
        username='admin',
        email='admin@***ARANGO_DB_NAME***.bio',
        first_name='Jim',
        last_name='Melancholy'
    )
    user.set_password('password')
    session.add(user)
    session.flush()
    return user


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
    user.set_password('password')
    session.add(user)
    session.flush()
    return user


@pytest.fixture(scope='function')
def private_fix_project(fix_owner, session) -> Project:
    project = Project(
        id=100,
        label='Project1',
        description='a test project',
        author='Jim Melancholy',
        graph=json.dumps({'project': 'project 1'}),
        user_id=fix_owner.id,
    )
    session.add(project)
    session.flush()

    project.set_hash_id()

    session.flush()

    return project


@pytest.fixture(scope='function')
def client(app):
    """Creates a HTTP client for REST actions for a test."""
    client = app.test_client()

    return client
