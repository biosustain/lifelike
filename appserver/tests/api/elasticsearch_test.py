import pytest
from unittest.mock import patch

from neo4japp.constants import FILE_INDEX_ID, FRAGMENT_SIZE
from neo4japp.models.files import Files
from neo4japp.services.elastic import ElasticService
from neo4japp.services.file_types.providers import DirectoryTypeProvider


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

        assert resp.status_code == 200
        mock_search.assert_called_once_with(
            index_id=FILE_INDEX_ID,
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

        assert resp.status_code == 200
        mock_search.assert_called_once_with(
            index_id=FILE_INDEX_ID,
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

        assert resp.status_code == 200
        mock_search.assert_called_once_with(
            index_id=FILE_INDEX_ID,
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

    ***ARANGO_USERNAME***_folder_hash_id = session.query(
        Files.hash_id
    ).filter(
        Files.id == fix_project.***ARANGO_USERNAME***_id
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
                'folders': ***ARANGO_USERNAME***_folder_hash_id,
            },
            content_type='multipart/form-data'
        )

        assert resp.status_code == 200
        mock_search.assert_called_once_with(
            index_id=FILE_INDEX_ID,
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
                                'term': {
                                    'path.tree': f'/{fix_project.name}'
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

    ***ARANGO_USERNAME***_folder_hash_id = session.query(
        Files.hash_id
    ).filter(
        Files.id == fix_project.***ARANGO_USERNAME***_id
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
                'folders': ***ARANGO_USERNAME***_folder_hash_id,
            },
            content_type='multipart/form-data'
        )

        assert resp.status_code == 200
        mock_search.assert_called_once_with(
            index_id=FILE_INDEX_ID,
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
                                'term': {
                                    'path.tree': f'/{fix_project.name}'
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
