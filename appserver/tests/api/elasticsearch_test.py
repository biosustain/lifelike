import base64
from http import HTTPStatus

import pytest
from unittest.mock import patch

from neo4japp.constants import FRAGMENT_SIZE
from neo4japp.models.files import Files
from neo4japp.services.elastic import ElasticService
from neo4japp.services.elastic.constants import ATTACHMENT_PIPELINE_ID
from neo4japp.services.file_types.providers import DirectoryTypeProvider
from neo4japp.utils.globals import config


def generate_headers(jwt_token):
    return {'Authorization': f'Bearer {jwt_token}'}


@pytest.fixture(scope='function')
def highlight():
    return {
        'fields': {
            'data.content': {},
        },
        'fragment_size': FRAGMENT_SIZE,
        'order': 'score',
        'pre_tags': ['@@@@$'],
        'post_tags': ['@@@@/$'],
        'number_of_fragments': 100,
    }


@pytest.fixture(scope='function')
def text_fields():
    return ['description', 'data.content', 'filename']


@pytest.fixture(scope='function')
def text_field_boosts():
    return {'description': 1, 'data.content': 1, 'filename': 3}


@pytest.fixture(scope='function')
def return_fields():
    return ['id']


@pytest.fixture(scope='function')
def pdf_document(
    elastic_service,
    test_user,
    test_user_with_pdf,
    fix_project,
):
    elastic_service.elastic_client.create(
        index=config.get('ELASTIC_FILE_INDEX_ID'),
        pipeline=ATTACHMENT_PIPELINE_ID,
        id='pdf_fixture_dup',
        body={
            'filename': 'example3.pdf',
            'description': 'mock pdf document for testing elasticsearch',
            'uploaded_date': None,
            'data': base64.b64encode('BOLA3'.encode('utf-8')).decode('utf-8'),
            'user_id': test_user.id,
            'username': 'test_user',
            'project_id': fix_project.id,
            'project_name': 'Lifelike',
            'doi': None,
            'public': True,
            'id': test_user_with_pdf.id,
            'mime_type': 'application/pdf',
            'path': '/Lifelike/example3.pdf'
        },
        # This option is MANDATORY! Otherwise the document won't be immediately visible to search.
        refresh='true'
    )


def test_user_can_search_content(
    client,
    test_user,
    fix_project,
    text_fields,
    text_field_boosts,
    return_fields,
    highlight,
):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['accessToken']['token'])

    with patch.object(
        ElasticService,
        'search',
        return_value=({'hits': {'hits': [], 'total': 0}}, [])
    ) as mock_search:
        resp = client.get(
            f'/search/content',
            headers=headers,
            data={
                'q': 'BOLA3',
                'limit': 10,
                'page': 1
            },
            content_type='multipart/form-data'
        )

        assert resp.status_code == HTTPStatus.OK
        mock_search.assert_called_once_with(
            index_id=config.get('ELASTIC_FILE_INDEX_ID'),
            user_search_query='BOLA3',
            offset=(1 - 1) * 10,
            limit=10,
            text_fields=text_fields,
            text_field_boosts=text_field_boosts,
            return_fields=return_fields,
            filter_=[
                {
                    'bool': {
                        'should': [
                            {'terms': {'project_id': [fix_project.id]}},
                            {'term': {'public': True}}
                        ]
                    }
                },
                {
                    'bool': {
                        'must_not': [
                            {'term': {'mime_type': DirectoryTypeProvider.MIME_TYPE}}
                        ]
                    }
                }
            ],
            highlight=highlight
        )


def test_user_can_search_content_with_single_types(
    client,
    test_user,
    fix_project,
    text_fields,
    text_field_boosts,
    return_fields,
    highlight,
):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['accessToken']['token'])

    with patch.object(
        ElasticService,
        'search',
        return_value=({'hits': {'hits': [], 'total': 0}}, [])
    ) as mock_search:

        resp = client.get(
            f'/search/content',
            headers=headers,
            data={
                'q': 'BOLA3',
                'limit': 10,
                'page': 1,
                'types': 'pdf',
            },
            content_type='multipart/form-data'
        )

        assert resp.status_code == HTTPStatus.OK
        mock_search.assert_called_once_with(
            index_id=config.get('ELASTIC_FILE_INDEX_ID'),
            user_search_query='BOLA3 (type:pdf)',
            offset=(1 - 1) * 10,
            limit=10,
            text_fields=text_fields,
            text_field_boosts=text_field_boosts,
            return_fields=return_fields,
            filter_=[
                {
                    'bool': {
                        'should': [
                            {'terms': {'project_id': [fix_project.id]}},
                            {'term': {'public': True}}
                        ]
                    }
                },
                {
                    'bool': {
                        'must_not': [
                            {'term': {'mime_type': DirectoryTypeProvider.MIME_TYPE}}
                        ]
                    }
                }
            ],
            highlight=highlight
        )


def test_user_can_search_content_with_multiple_types(
    client,
    test_user,
    fix_project,
    text_fields,
    text_field_boosts,
    return_fields,
    highlight,
):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['accessToken']['token'])

    with patch.object(
        ElasticService,
        'search',
        return_value=({'hits': {'hits': [], 'total': 0}}, [])
    ) as mock_search:

        resp = client.get(
            f'/search/content',
            headers=headers,
            data={
                'q': 'BOLA3',
                'limit': 10,
                'page': 1,
                'types': 'pdf;map',
            },
            content_type='multipart/form-data'
        )

        assert resp.status_code == HTTPStatus.OK
        mock_search.assert_called_once_with(
            index_id=config.get('ELASTIC_FILE_INDEX_ID'),
            user_search_query='BOLA3 (type:pdf OR type:map)',
            offset=(1 - 1) * 10,
            limit=10,
            text_fields=text_fields,
            text_field_boosts=text_field_boosts,
            return_fields=return_fields,
            filter_=[
                {
                    'bool': {
                        'should': [
                            {'terms': {'project_id': [fix_project.id]}},
                            {'term': {'public': True}}
                        ]
                    }
                },
                {
                    'bool': {
                        'must_not': [
                            {'term': {'mime_type': DirectoryTypeProvider.MIME_TYPE}}
                        ]
                    }
                }
            ],
            highlight=highlight
        )


def test_user_can_search_content_with_folder(
    client,
    session,
    test_user,
    fix_project,
    text_fields,
    text_field_boosts,
    return_fields,
    highlight,
):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['accessToken']['token'])

    root_folder_hash_id = session.query(
        Files.hash_id
    ).filter(
        Files.id == fix_project.root_id
    ).scalar()

    with patch.object(
        ElasticService,
        'search',
        return_value=({'hits': {'hits': [], 'total': 0}}, [])
    ) as mock_search:

        resp = client.get(
            f'/search/content',
            headers=headers,
            data={
                'q': 'BOLA3',
                'limit': 10,
                'page': 1,
                'folders': root_folder_hash_id,
            },
            content_type='multipart/form-data'
        )

        assert resp.status_code == HTTPStatus.OK
        mock_search.assert_called_once_with(
            index_id=config.get('ELASTIC_FILE_INDEX_ID'),
            user_search_query='BOLA3',
            offset=(1 - 1) * 10,
            limit=10,
            text_fields=text_fields,
            text_field_boosts=text_field_boosts,
            return_fields=return_fields,
            filter_=[
                {
                    'bool': {
                        'should': [
                            {
                                'terms': {
                                    'path.tree': [f'/{fix_project.name}']
                                }
                            }
                        ]
                    }
                },
                {
                    'bool': {
                        'must_not': [
                            {'term': {'mime_type': DirectoryTypeProvider.MIME_TYPE}}
                        ]
                    }
                }
            ],
            highlight=highlight
        )


def test_user_can_search_content_type_and_folder(
    client,
    session,
    test_user,
    fix_project,
    text_fields,
    text_field_boosts,
    return_fields,
    highlight,
):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['accessToken']['token'])

    root_folder_hash_id = session.query(
        Files.hash_id
    ).filter(
        Files.id == fix_project.root_id
    ).scalar()

    with patch.object(
        ElasticService,
        'search',
        return_value=({'hits': {'hits': [], 'total': 0}}, [])
    ) as mock_search:

        resp = client.get(
            f'/search/content',
            headers=headers,
            data={
                'q': 'BOLA3',
                'limit': 10,
                'page': 1,
                'types': 'enrichment-table;map;pdf',
                'folders': root_folder_hash_id,
            },
            content_type='multipart/form-data'
        )

        assert resp.status_code == HTTPStatus.OK
        mock_search.assert_called_once_with(
            index_id=config.get('ELASTIC_FILE_INDEX_ID'),
            user_search_query='BOLA3 (type:enrichment-table OR type:map OR type:pdf)',
            offset=(1 - 1) * 10,
            limit=10,
            text_fields=text_fields,
            text_field_boosts=text_field_boosts,
            return_fields=return_fields,
            filter_=[
                {
                    'bool': {
                        'should': [
                            {
                                'terms': {
                                    'path.tree': [f'/{fix_project.name}']
                                }
                            }
                        ]
                    }
                },
                {
                    'bool': {
                        'must_not': [
                            {'term': {'mime_type': DirectoryTypeProvider.MIME_TYPE}}
                        ]
                    }
                }
            ],
            highlight=highlight
        )


def test_search_service_returns_child_of_folder(
    client,
    session,
    test_user,
    test_user_with_pdf,
    fix_project,
    # Included here to make sure the pdf is immediately available in elastic
    pdf_document
):
    # Login as our test user
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['accessToken']['token'])

    root_folder_hash_id = session.query(
        Files.hash_id
    ).filter(
        Files.id == fix_project.root_id
    ).scalar()

    resp = client.get(
        f'/search/content',
        headers=headers,
        data={
            'q': 'BOLA3',
            'limit': 10,
            'page': 1,
            'folders': root_folder_hash_id,
        },
        content_type='multipart/form-data'
    )

    assert resp.status_code == HTTPStatus.OK

    data = resp.get_json()

    assert data['total'] == 1
    assert data['results'][0]['item']['hashId'] == test_user_with_pdf.hash_id
