import json
import hashlib
import json
import os
import types
from datetime import datetime

import pytest

from neo4japp.models import (
    AppRole,
    AppUser,
    Directory,
    GlobalList,
    Project,
    Projects,
    projects_collaborator_role,
    FileContent,
    Files,
    DomainURLsMap,
    FallbackOrganism
)
from neo4japp.services.annotations import AnnotationGraphService, ManualAnnotationService
from neo4japp.services.annotations.constants import EntityType, ManualAnnotationType
from neo4japp.services.elastic import ElasticService


#################
# Service mocks
################

@pytest.fixture(scope='function')
def mock_global_compound_inclusion(session):
    annotation = {
        'meta': {
            'id': 'BIOC:Fake',
            'type': EntityType.COMPOUND.value,
        },
        'keyword': 'compound-(12345)'
    }

    file_content = FileContent(raw_file=b'', checksum_sha256=b'')
    session.add(file_content)
    session.flush()

    inclusion = GlobalList(
        annotation=annotation,
        type=ManualAnnotationType.INCLUSION.value,
        file_id=file_content.id,
        reviewed=True,
        approved=True,
    )

    session.add(inclusion)
    session.flush()


@pytest.fixture(scope='function')
def mock_global_gene_exclusion(session):
    annotation = {
        'meta': {
            'id': '59272',
            'type': EntityType.GENE.value,
        },
        'keyword': 'fake-gene'
    }

    file_content = FileContent(raw_file=b'', checksum_sha256=b'')
    session.add(file_content)
    session.flush()

    exclusion = GlobalList(
        annotation=annotation,
        type=ManualAnnotationType.EXCLUSION.value,
        file_id=file_content.id,
        reviewed=True,
        approved=True,
    )

    session.add(exclusion)
    session.flush()


@pytest.fixture(scope='function')
def mock_global_list(session):
    file_content = FileContent(raw_file=b'', checksum_sha256=b'')
    session.add(file_content)
    session.flush()

    annotation = {
        'meta': {
            'id': 'BIOC:Fake',
            'type': EntityType.COMPOUND.value,
        },
        'keyword': 'compound-(12345)'
    }
    inclusion = GlobalList(
        annotation=annotation,
        type=ManualAnnotationType.INCLUSION.value,
        file_id=file_content.id,
        reviewed=True,
        approved=True,
    )
    session.add(inclusion)
    session.flush()

    annotation = {
        'id': '59272',
        'type': EntityType.GENE.value,
        'text': 'fake-gene'
    }
    exclusion = GlobalList(
        annotation=annotation,
        type=ManualAnnotationType.EXCLUSION.value,
        file_id=file_content.id,
        reviewed=True,
        approved=True,
    )
    session.add(exclusion)
    session.flush()


@pytest.fixture(scope='function')
def mock_get_combined_annotations_result(monkeypatch):
    def get_combined_annotations_result(*args, **kwargs):
        return [
            {
                'meta': {
                    'type': EntityType.GENE.value,
                    'id': '59272',
                },
                'keyword': 'ace2',
                'primaryName': 'ACE2',
            },
            {
                'meta': {
                    'type': EntityType.SPECIES.value,
                    'id': '9606',
                },
                'keyword': 'human',
                'primaryName': 'Homo Sapiens',
            },
        ]

    monkeypatch.setattr(
        ManualAnnotationService,
        'get_combined_annotations',
        get_combined_annotations_result,
    )


@pytest.fixture(scope='function')
def mock_get_combined_annotations_in_project_result(monkeypatch):
    def get_combined_annotations_in_project_result(*args, **kwargs):
        return [
            {
                'meta': {
                    'type': EntityType.GENE.value,
                    'id': '59272',
                },
                'keyword': 'ace2',
                'primaryName': 'ACE2',
            },
            {
                'meta': {
                    'type': EntityType.SPECIES.value,
                    'id': '9606',
                },
                'keyword': 'human',
                'primaryName': 'Homo Sapiens',
            },
        ]

    monkeypatch.setattr(
        ManualAnnotationService,
        'get_combined_annotations_in_project',
        get_combined_annotations_in_project_result,
    )


@pytest.fixture(scope='function')
def mock_get_files_annotations_in_project_result(monkeypatch):
    def get_files_annotations_in_project_result(*args, **kwargs):
        return {
            "a": [
                {
                    'meta': {
                        'type': EntityType.GENE.value,
                        'id': '59272',
                    },
                    'keyword': 'ace2',
                    'primaryName': 'ACE2',
                },
                {
                    'meta': {
                        'type': EntityType.SPECIES.value,
                        'id': '9606',
                    },
                    'keyword': 'human',
                    'primaryName': 'Homo Sapiens',
                }
            ],
            "b": [
                {
                    'meta': {
                        'type': EntityType.SPECIES.value,
                        'id': '9606',
                    },
                    'keyword': 'human',
                    'primaryName': 'Homo Sapiens',
                },
                {
                    'meta': {
                        'type': EntityType.SPECIES.value,
                        'id': '9606',
                    },
                    'keyword': 'human',
                    'primaryName': 'Homo Sapiens',
                }
            ],
        }

    monkeypatch.setattr(
        ManualAnnotationService,
        'get_files_annotations_in_project',
        get_files_annotations_in_project_result,
    )


@pytest.fixture(scope='function')
def mock_get_organisms_from_gene_ids_result(monkeypatch):
    def get_organisms_from_gene_ids_result(*args, **kwargs):
        return [
            {
                'gene_id': '59272',
                'gene_name': 'ACE2',
                'taxonomy_id': '9606',
                'species_name': 'Homo sapiens',
            }
        ]

    monkeypatch.setattr(
        AnnotationGraphService,
        'get_organisms_from_gene_ids',
        get_organisms_from_gene_ids_result,
    )


@pytest.fixture(scope='function')
def mock_index_files(monkeypatch):
    def index_files(*args, **kwargs):
        return None

    monkeypatch.setattr(
        ElasticService,
        'index_files',
        index_files,
    )


@pytest.fixture(scope='function')
def mock_index_maps(monkeypatch):
    def index_maps(*args, **kwargs):
        return None

    monkeypatch.setattr(
        ElasticService,
        'index_maps',
        index_maps,
    )


@pytest.fixture(scope='function')
def mock_delete_elastic_documents(monkeypatch):
    def delete_documents_with_index(*args, **kwargs):
        return None

    monkeypatch.setattr(
        ElasticService,
        'delete_documents_with_index',
        delete_documents_with_index,
    )


####################
# End service mocks
####################


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
    private_data_access_role = account_user.get_or_create_role('private-data-access')
    user.roles.extend([admin_role, private_data_access_role])
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
    fake_file = None
    with open(pdf_path, 'rb') as pdf_file:
        pdf_content = pdf_file.read()

        file_content = FileContent(
            raw_file=pdf_content,
            checksum_sha256=hashlib.sha256(pdf_content).digest(),
            creation_date=datetime.now(),
        )
        session.add(file_content)
        session.flush()

        fallback = FallbackOrganism(
            organism_name='Homo sapiens',
            organism_synonym='Homo sapiens',
            organism_taxonomy_id='9606'
        )

        session.add(fallback)
        session.flush()

        fake_file = Files(
            file_id='unknown',
            filename='example3.pdf',
            content_id=file_content.id,
            user_id=test_user.id,
            creation_date=datetime.now(),
            project=fix_project.id,
            dir_id=fix_directory.id,
            fallback_organism_id=fallback.id
        )
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
        [{
            'appuser_id': test_user.id,
            'app_role_id': role.id,
            'projects_id': project.id,
        }]
    )
    session.flush()
    return project


@pytest.fixture(scope='function')
def fix_directory(fix_project, test_user, session):
    directory = Directory(
        name='/',
        directory_parent_id=None,
        projects_id=fix_project.id,
        user_id=test_user.id,
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
                    "source": "/dt/pdf/0df1c8e0-50a4-4770-9942-621bc1f1cb28/1/98.064/706.8/121.47984/717.8399999999999",
                    # noqa
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
                            "domain": "mesh",
                            "url": "https://www.ncbi.nlm.nih.gov/mesh/?term=E. coli"
                        },
                        {
                            "domain": "chebi",
                            "url": "https://www.ebi.ac.uk/chebi/advancedSearchFT.do?searchString=E. coli"  # noqa
                        },
                        {
                            "domain": "pubchem",
                            "url": "https://pubchem.ncbi.nlm.nih.gov/#query=E. coli"
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
    credentials = {'email': email, 'password': password}
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


@pytest.fixture(scope='function')
def uri_fixture(client, session):
    uri1 = DomainURLsMap(domain="CHEBI", base_URL="https://www.ebi.ac.uk/chebi/searchId.do?chebiId={}")  # noqa
    uri2 = DomainURLsMap(domain="MESH", base_URL="https://www.ncbi.nlm.nih.gov/mesh/?term={}")

    session.add(uri1)
    session.add(uri2)
    session.flush()

    return uri1

# TODO: Need to create actual mock data for these
