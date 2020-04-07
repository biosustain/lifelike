import json
import pytest

from datetime import date
from os import path

from neo4japp.models import AppUser, Project
from neo4japp.services.annotations import prepare_databases


@pytest.fixture(scope='function')
def fix_owner(session) -> AppUser:
    user = AppUser(
        id=100,
        username='admin',
        email='admin@***ARANGO_DB_NAME***.bio',
        password_hash='password',
    )
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
    )
    session.add(user)
    session.flush()
    return user


@pytest.fixture(scope='function')
def fix_project(fix_owner, session) -> Project:
    project = Project(
        id=100,
        label='Project1',
        description='a test project',
        date_modified=str(date.today()),
        graph=json.dumps({'project': 'project 1'}),
        user_id=fix_owner.id,
    )
    session.add(project)
    session.flush()
    return project


@pytest.fixture(scope='function')
def annotations_setup(app):
    # reference to this directory
    directory = path.realpath(path.dirname(__file__))

    # run neo4japp/services/annotations/prepare_databases.py

    # below is not working, always says files are not there
    # if not path.exists(
    #     path.join(
    #         directory,
    #         '../../neo4japp/services/annotations/lmdb/genes/data.mdb')):
    #     prepare_lmdb_genes_database()

    # if not path.exists(
    #     path.join(
    #         directory,
    #         '../../neo4japp/services/annotations/lmdb/chemicals/data.mdb')):
    #     prepare_lmdb_chemicals_database()

    # if not path.exists(
    #     path.join(
    #         directory,
    #         '../../neo4japp/services/annotations/lmdb/compounds/data.mdb')):
    #     prepare_lmdb_compounds_database()

    # if not path.exists(
    #     path.join(
    #         directory,
    #         '../../neo4japp/services/annotations/lmdb/proteins/data.mdb')):
    #     prepare_lmdb_proteins_database()

    # if not path.exists(
    #     path.join(
    #         directory,
    #         '../../neo4japp/services/annotations/lmdb/species/data.mdb')):
    #     prepare_lmdb_species_database()

    # if not path.exists(
    #     path.join(
    #         directory,
    #         '../../neo4japp/services/annotations/lmdb/diseases/data.mdb')):
    #     prepare_lmdb_diseases_database()
