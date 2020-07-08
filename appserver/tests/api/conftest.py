import binascii
import json
import hashlib
import os
import types
import hashlib
import pytest
from datetime import date, datetime
from neo4japp.models import (
    AppUser,
    Project,
    Projects,
    FileContent,
    Files,
    DomainULRsMap,
    AnnotationStyle
)

from neo4japp.models import AnnotationStyle


@pytest.fixture(scope='function')
def fix_api_owner(session, account_user) -> AppUser:
    user = AppUser(
        id=100,
        username='admin',
        email='admin@lifelike.bio',
        first_name='Jim',
        last_name='Melancholy',
    )
    user.set_password('password')
    admin_role = account_user.get_or_create_role('admin')
    user.roles.extend([admin_role])
    session.add(user)
    session.flush()
    return user


@pytest.fixture(scope='function')
def test_user(session) -> AppUser:
    user = AppUser(
        id=200,
        username='test',
        email='test@lifelike.bio',
        first_name='Jim',
        last_name='Melancholy'
    )
    user.set_password('password')
    session.add(user)
    session.flush()
    return user


@pytest.fixture(scope='function')
def test_user_2(session) -> AppUser:
    user = AppUser(
        id=300,
        username='pleb',
        email='pleblife@hut.org',
        first_name='pleb',
        last_name='life',
    )
    user.set_password('password')
    session.add(user)
    session.flush()
    return user


@pytest.fixture(scope='function')
def test_user_with_pdf(session, test_user, fix_project, pdf_dir) -> Files:
    pdf_path = os.path.join(pdf_dir, 'example3.pdf')
    pdf_file = open(pdf_path, 'rb')
    pdf_content = pdf_file.read()
    pdf_file.seek(0)

    file_content = FileContent(
        raw_file=pdf_file.read(),
        checksum_sha256=hashlib.sha256(pdf_content).digest(),
        creation_date=datetime.now(),
    )
    session.add(file_content)
    session.flush()

    fake_file = Files(
        file_id='unknown',
        filename='example3.pdf',
        content_id=file_content.id,
        user_id=test_user.id,
        creation_date=datetime.now(),
        annotations={},
        annotations_date=datetime.now(),
        project=fix_project.id,
        custom_annotations=[],
        excluded_annotations=[],
    )
    session.add(fake_file)
    session.flush()
    # TODO: Refactor the file ids
    fake_file.file_id = fake_file.id
    session.add(fake_file)
    session.flush()
    return fake_file


@pytest.fixture(scope='function')
def fix_project(test_user, session):
    project = Projects(
        project_name='Lifelike',
        description='Test project',
        creation_date=datetime.now(),
        users=[test_user.id],
    )
    session.add(project)
    session.flush()
    return project


@pytest.fixture(scope='function')
def private_fix_project(fix_api_owner, session) -> Project:
    project = Project(
        id=100,
        label='Project1',
        description='a test project',
        author='Jim Melancholy',
        graph=json.dumps({'project': 'project 1'}),
        user_id=fix_api_owner.id,
    )
    session.add(project)
    session.flush()

    project.set_hash_id()

    session.flush()

    return project


def login_as_user(self, email, password):
    """ Returns the authenticated JWT tokens """
    credentials = dict(email=email, password=password)
    login_resp = self.post(
        '/auth/login',
        data=json.dumps(credentials),
        content_type='application/json',
    )
    return login_resp.get_json()


@pytest.fixture(scope='function')
def client(app):
    """Creates a HTTP client for REST actions for a test."""
    client = app.test_client()
    client.login_as_user = types.MethodType(login_as_user, client)
    return client


@pytest.fixture(scope='function')
def user_client(client, test_user):
    """ Returns an authenticated client as well as the JWT information """
    auth = client.login_as_user('test@lifelike.bio', 'password')
    return client, auth


@pytest.fixture(scope='function')
def styles_fixture(client, session):

    style = AnnotationStyle(
        label='gene',
        color='#232323'
    )
    style2 = AnnotationStyle(
        label="association",
        color="#d7d9f8",
        style_border="#d7d9f8",
        style_background="#d7d9f8",
        style_color="#000"
    )
    session.add(style)
    session.add(style2)
    session.flush()

    return style


@pytest.fixture(scope='function')
def uri_fixture(client, session):
    uri1 = DomainULRsMap(domain="CHEBI", base_URL="https://www.ebi.ac.uk/chebi/searchId.do?chebiId=")
    uri2 = DomainULRsMap(domain="MESH", base_URL="https://www.ncbi.nlm.nih.gov/mesh/?term=")

    session.add(uri1)
    session.add(uri2)
    session.flush()

    return uri1
