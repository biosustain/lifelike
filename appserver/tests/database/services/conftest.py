import json
import pytest

from datetime import date
from os import path

from neo4japp.models import AppUser, Directory, Project, Projects
from neo4japp.services.annotations import prepare_databases


@pytest.fixture(scope='function')
def fix_owner(session) -> AppUser:
    user = AppUser(
        id=100,
        username='admin',
        email='admin@lifelike.bio',
        password_hash='password',
        first_name='Jim',
        last_name='Melancholy'
    )
    session.add(user)
    session.flush()
    return user


@pytest.fixture(scope='function')
def test_user(session) -> AppUser:
    user = AppUser(
        id=200,
        username='test',
        email='test@lifelike.bio',
        password_hash='password',
        first_name='Jim',
        last_name='Melancholy'
    )
    session.add(user)
    session.flush()
    return user


@pytest.fixture(scope='function')
def fix_projects(session) -> Projects:
    projects = Projects(
        project_name='test-project',
        description='test project',
        users=[],
    )
    session.add(projects)
    session.flush()

    return projects


@pytest.fixture(scope='function')
def fix_directory(session, fix_projects, test_user) -> Directory:
    directory = Directory(
        name='/',
        directory_parent_id=None,
        projects_id=fix_projects.id,
        user_id=test_user.id,
    )
    session.add(directory)
    session.flush()
    return directory


@pytest.fixture(scope='function')
def fix_project(fix_owner, fix_directory, session) -> Project:
    project = Project(
        id=100,
        label='Project1',
        description='a test project',
        author='Jim Melancholy',
        date_modified=str(date.today()),
        graph=json.dumps({'project': 'project 1'}),
        user_id=fix_owner.id,
        dir_id=fix_directory.id,
    )
    session.add(project)
    session.flush()
    return project


@pytest.fixture(scope='function')
def fix_nested_dir(fix_owner, fix_directory, session) -> Directory:
    child_dir = Directory(
        name='child-level-1',
        directory_parent_id=fix_directory.id,
        projects_id=fix_directory.projects_id,
        user_id=fix_owner.id,
    )
    session.add(child_dir)
    session.flush()
    return child_dir
