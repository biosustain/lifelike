import binascii
import json
import hashlib
import os
import types
import hashlib
import pytest
from datetime import date, datetime
from neo4japp.models import (
    AppRole,
    AppUser,
    Directory,
    Project,
    Projects,
    projects_collaborator_role,
    FileContent,
    Files,
)


@pytest.fixture(scope='function')
def fix_api_owner(session, account_user) -> AppUser:
    user = AppUser(
        id=100,
        username='admin',
        email='admin@***ARANGO_DB_NAME***.bio',
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
        email='test@***ARANGO_DB_NAME***.bio',
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
def test_user_with_pdf(
        session, test_user, fix_project, fix_directory, pdf_dir) -> Files:
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
        project=fix_project.id,
        dir_id=fix_directory.id,
        custom_annotations=[]
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

    role = AppRole.query.filter(
        AppRole.name == 'project-admin'
    ).one()

    session.execute(
        projects_collaborator_role.insert(),
        [dict(
            appuser_id=test_user.id,
            app_role_id=role.id,
            projects_id=project.id,
        )]
    )
    session.flush()
    return project


@pytest.fixture(scope='function')
def fix_directory(fix_project, session):
    directory = Directory(
        name='/',
        directory_parent_id=None,
        projects_id=fix_project.id,
    )
    session.add(directory)
    session.flush()
    return directory


@pytest.fixture(scope='function')
def private_fix_map(fix_api_owner, fix_directory, session) -> Project:
    example_data = {
        "edges": [],
        "nodes": [
            {
                "data": {
                    "x": -251,
                    "y": -323,
                    "hyperlink": "https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=511145",  # noqa
                    "detail": "dddd",
                    "source": "/dt/pdf/0df1c8e0-50a4-4770-9942-621bc1f1cb28/1/98.064/706.8/121.47984/717.8399999999999",  # noqa
                    "search": [
                        {
                            "domain": "google",
                            "url": "https://www.google.com/search?q=E. coli"
                        },
                        {
                            "domain": "ncbi",
                            "url": "https://www.ncbi.nlm.nih.gov/gene/?query=E. coli"
                        },
                        {
                            "domain": "uniprot",
                            "url": "https://www.uniprot.org/uniprot/?sort=score&query=E. coli"
                        },
                        {
                            "domain": "wikipedia",
                            "url": "https://www.google.com/search?q=site:+wikipedia.org+E. coli"
                        }
                    ]
                },
                "display_name": "E. coli",
                "hash": "dae84a2f-17ef-444e-b875-13b732a71794",
                "shape": "box",
                "label": "species",
                "sub_labels": []
            }
        ]
    }

    project = Project(
        id=100,
        label='Project1',
        description='a test project',
        author='Jim Melancholy',
        graph=example_data,
        user_id=fix_api_owner.id,
        dir_id=fix_directory.id,
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
    auth = client.login_as_user('test@***ARANGO_DB_NAME***.bio', 'password')
    return client, auth
