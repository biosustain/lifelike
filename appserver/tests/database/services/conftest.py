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
def fix_directory(session, fix_projects) -> Directory:
    directory = Directory(
        name='/',
        directory_parent_id=None,
        projects_id=fix_projects.id,
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
def annotations_setup(app):
    # reference to this directory
    directory = path.realpath(path.dirname(__file__))

    # below is not working, always says files are not there
    # if not path.exists(
    #     path.join(
    #         directory,
    #         '../../neo4japp/services/annotations/lmdb/genes/data.mdb')):
    #     prepare_databases.prepare_lmdb_genes_database()

    # if not path.exists(
    #     path.join(
    #         directory,
    #         '../../neo4japp/services/annotations/lmdb/chemicals/data.mdb')):
    #     prepare_databases.prepare_lmdb_chemicals_database()

    # if not path.exists(
    #     path.join(
    #         directory,
    #         '../../neo4japp/services/annotations/lmdb/compounds/data.mdb')):
    #     prepare_databases.prepare_lmdb_compounds_database()

    # if not path.exists(
    #     path.join(
    #         directory,
    #         '../../neo4japp/services/annotations/lmdb/proteins/data.mdb')):
    #     prepare_databases.prepare_lmdb_proteins_database()

    # if not path.exists(
    #     path.join(
    #         directory,
    #         '../../neo4japp/services/annotations/lmdb/species/data.mdb')):
    #     prepare_databases.prepare_lmdb_species_database()

    # if not path.exists(
    #     path.join(
    #         directory,
    #         '../../neo4japp/services/annotations/lmdb/diseases/data.mdb')):
    #     prepare_databases.prepare_lmdb_diseases_database()
