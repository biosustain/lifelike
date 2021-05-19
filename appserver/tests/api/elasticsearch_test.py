import pytest
from unittest.mock import patch

from neo4japp.constants import FILE_INDEX_ID, FRAGMENT_SIZE
from neo4japp.services.elastic import ElasticService
from neo4japp.services.elastic.constants import ATTACHMENT_PIPELINE_ID
from neo4japp.services.file_types.providers import (
    EnrichmentTableTypeProvider,
    MapTypeProvider,
    PDFTypeProvider
)


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
def keyword_fields():
    return []


@pytest.fixture(scope='function')
def keyword_field_boosts():
    return {}


@pytest.mark.skip(reason='Skipping until Neo4j container is updated')
def test_user_can_search_content(
    client,
    session,
    test_user,
    test_user_with_pdf,
    fix_project,
    elastic_service,
    text_fields,
    text_field_boosts,
    keyword_fields,
    keyword_field_boosts,
    highlight,
):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['accessToken']['token'])

    with patch.object(
        ElasticService,
        'search',
        return_value=({'hits': {'hits': [], 'total': 0}}, [], {})
    ) as mock_search:
        resp = client.post(
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
            search_term='BOLA3',
            offset=(1 - 1) * 10,
            limit=10,
            text_fields=text_fields,
            text_field_boosts=text_field_boosts,
            keyword_fields=keyword_fields,
            keyword_field_boosts=keyword_field_boosts,
            use_synonyms=True,
            query_filter={
                'bool': {
                    'must': [
                        {
                            'terms': {
                                'mime_type': [
                                    EnrichmentTableTypeProvider.MIME_TYPE,
                                    MapTypeProvider.MIME_TYPE,
                                    PDFTypeProvider.MIME_TYPE,
                                ]
                            }
                        },
                        {
                            'bool': {
                                'should': [
                                    {'terms': {'project_id': [fix_project.id]}},
                                    {'term': {'public': True}}
                                ]
                            }
                        }
                    ]
                }
            },
            highlight=highlight
        )


@pytest.mark.skip(reason='Skipping until Neo4j container is updated')
def test_user_can_search_content_with_advanced_args(
    client,
    session,
    test_user,
    test_user_with_pdf,
    fix_project,
    elastic_service,
    text_fields,
    text_field_boosts,
    keyword_fields,
    keyword_field_boosts,
    highlight,
):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['accessToken']['token'])

    with patch.object(
        ElasticService,
        'search',
        return_value=({'hits': {'hits': [], 'total': 0}}, [], {})
    ) as mock_search:

        resp = client.post(
            f'/search/content',
            headers=headers,
            data={
                'q': 'BOLA3',
                'limit': 10,
                'page': 1,
                'types': 'enrichment-table;map;pdf',
                'projects': '',
                'phrase': '',
                'wildcard': '',
            },
            content_type='multipart/form-data'
        )

        assert resp.status_code == 200
        mock_search.assert_called_once_with(
            index_id=FILE_INDEX_ID,
            search_term='BOLA3',
            offset=(1 - 1) * 10,
            limit=10,
            text_fields=text_fields,
            text_field_boosts=text_field_boosts,
            keyword_fields=keyword_fields,
            keyword_field_boosts=keyword_field_boosts,
            use_synonyms=True,
            query_filter={
                'bool': {
                    'must': [
                        {
                            'terms': {
                                'mime_type': [
                                    EnrichmentTableTypeProvider.MIME_TYPE,
                                    MapTypeProvider.MIME_TYPE,
                                    PDFTypeProvider.MIME_TYPE,
                                ]
                            }
                        },
                        {
                            'bool': {
                                'should': [
                                    {'terms': {'project_id': [fix_project.id]}},
                                    {'term': {'public': True}}
                                ]
                            }
                        }
                    ]
                }
            },
            highlight=highlight
        )


@pytest.mark.skip(reason='Skipping until Neo4j container is updated')
def test_user_can_search_content_with_single_types(
    client,
    session,
    test_user,
    test_user_with_pdf,
    fix_project,
    elastic_service,
    text_fields,
    text_field_boosts,
    keyword_fields,
    keyword_field_boosts,
    highlight,
):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['accessToken']['token'])

    with patch.object(
        ElasticService,
        'search',
        return_value=({'hits': {'hits': [], 'total': 0}}, [], {})
    ) as mock_search:

        resp = client.post(
            f'/search/content',
            headers=headers,
            data={
                'q': '',
                'types': 'pdf',
                'limit': 10,
                'page': 1
            },
            content_type='multipart/form-data'
        )

        assert resp.status_code == 200
        mock_search.assert_called_once_with(
            index_id=FILE_INDEX_ID,
            search_term='',
            offset=(1 - 1) * 10,
            limit=10,
            text_fields=text_fields,
            text_field_boosts=text_field_boosts,
            keyword_fields=keyword_fields,
            keyword_field_boosts=keyword_field_boosts,
            use_synonyms=True,
            query_filter={
                'bool': {
                    'must': [
                        {'terms': {'mime_type': [PDFTypeProvider.MIME_TYPE]}},
                        {
                            'bool': {
                                'should': [
                                    {'terms': {'project_id': [fix_project.id]}},
                                    {'term': {'public': True}}
                                ]
                            }
                        }
                    ]
                }
            },
            highlight=highlight
        )


@pytest.mark.skip(reason='Skipping until Neo4j container is updated')
def test_user_can_search_content_with_multiple_types(
    client,
    session,
    test_user,
    test_user_with_pdf,
    fix_project,
    elastic_service,
    text_fields,
    text_field_boosts,
    keyword_fields,
    keyword_field_boosts,
    highlight,
):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['accessToken']['token'])

    with patch.object(
        ElasticService,
        'search',
        return_value=({'hits': {'hits': [], 'total': 0}}, [], {})
    ) as mock_search:

        resp = client.post(
            f'/search/content',
            headers=headers,
            data={
                'q': '',
                'types': 'enrichment-table;map;pdf',
                'limit': 10,
                'page': 1
            },
            content_type='multipart/form-data'
        )

        assert resp.status_code == 200
        mock_search.assert_called_once_with(
            index_id=FILE_INDEX_ID,
            search_term='',
            offset=(1 - 1) * 10,
            limit=10,
            text_fields=text_fields,
            text_field_boosts=text_field_boosts,
            keyword_fields=keyword_fields,
            keyword_field_boosts=keyword_field_boosts,
            use_synonyms=True,
            query_filter={
                'bool': {
                    'must': [
                        {
                            'terms': {
                                'mime_type': [
                                    EnrichmentTableTypeProvider.MIME_TYPE,
                                    MapTypeProvider.MIME_TYPE,
                                    PDFTypeProvider.MIME_TYPE,
                                ]
                            }
                        },
                        {
                            'bool': {
                                'should': [
                                    {'terms': {'project_id': [fix_project.id]}},
                                    {'term': {'public': True}}
                                ]
                            }
                        }
                    ]
                }
            },
            highlight=highlight
        )


@pytest.mark.skip(reason='Skipping until Neo4j container is updated')
def test_user_can_search_content_with_project(
    client,
    session,
    test_user,
    test_user_with_pdf,
    fix_project,
    elastic_service,
    text_fields,
    text_field_boosts,
    keyword_fields,
    keyword_field_boosts,
    highlight,
):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['accessToken']['token'])

    with patch.object(
        ElasticService,
        'search',
        return_value=({'hits': {'hits': [], 'total': 0}}, [], {})
    ) as mock_search:

        resp = client.post(
            f'/search/content',
            headers=headers,
            data={
                'q': '',
                'projects': f'{fix_project.name}',
                'limit': 10,
                'page': 1
            },
            content_type='multipart/form-data'
        )

        assert resp.status_code == 200
        mock_search.assert_called_once_with(
            index_id=FILE_INDEX_ID,
            search_term='',
            offset=(1 - 1) * 10,
            limit=10,
            text_fields=text_fields,
            text_field_boosts=text_field_boosts,
            keyword_fields=keyword_fields,
            keyword_field_boosts=keyword_field_boosts,
            use_synonyms=True,
            query_filter={
                'bool': {
                    'must': [
                        {
                            'terms': {
                                'mime_type': [
                                    EnrichmentTableTypeProvider.MIME_TYPE,
                                    MapTypeProvider.MIME_TYPE,
                                    PDFTypeProvider.MIME_TYPE,
                                ]
                            }
                        },
                        {
                            'bool': {
                                'must': [
                                    {'terms': {'project_id': [fix_project.id]}},
                                ]
                            }
                        }
                    ]
                }
            },
            highlight=highlight
        )


@pytest.mark.skip(reason='Skipping until Neo4j container is updated')
def test_user_can_search_content_with_phrase(
    client,
    session,
    test_user,
    test_user_with_pdf,
    fix_project,
    elastic_service,
    text_fields,
    text_field_boosts,
    keyword_fields,
    keyword_field_boosts,
    highlight,
):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['accessToken']['token'])

    with patch.object(
        ElasticService,
        'search',
        return_value=({'hits': {'hits': [], 'total': 0}}, [], {})
    ) as mock_search:

        resp = client.post(
            f'/search/content',
            headers=headers,
            data={
                'q': '',
                'phrase': 'BOLA3',
                'limit': 10,
                'page': 1
            },
            content_type='multipart/form-data'
        )

        assert resp.status_code == 200
        mock_search.assert_called_once_with(
            index_id=FILE_INDEX_ID,
            search_term='"BOLA3"',
            offset=(1 - 1) * 10,
            limit=10,
            text_fields=text_fields,
            text_field_boosts=text_field_boosts,
            keyword_fields=keyword_fields,
            keyword_field_boosts=keyword_field_boosts,
            use_synonyms=True,
            query_filter={
                'bool': {
                    'must': [
                        {
                            'terms': {
                                'mime_type': [
                                    EnrichmentTableTypeProvider.MIME_TYPE,
                                    MapTypeProvider.MIME_TYPE,
                                    PDFTypeProvider.MIME_TYPE,
                                ]
                            }
                        },
                        {
                            'bool': {
                                'should': [
                                    {'terms': {'project_id': [fix_project.id]}},
                                    {'term': {'public': True}}
                                ]
                            }
                        }
                    ]
                }
            },
            highlight=highlight
        )


@pytest.mark.skip(reason='Skipping until Neo4j container is updated')
def test_user_can_search_content_with_wildcard(
    client,
    session,
    test_user,
    test_user_with_pdf,
    fix_project,
    elastic_service,
    text_fields,
    text_field_boosts,
    keyword_fields,
    keyword_field_boosts,
    highlight,
):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['accessToken']['token'])

    with patch.object(
        ElasticService,
        'search',
        return_value=({'hits': {'hits': [], 'total': 0}}, [], {})
    ) as mock_search:

        resp = client.post(
            f'/search/content',
            headers=headers,
            data={
                'q': 'B*3',
                'limit': 10,
                'page': 1
            },
            content_type='multipart/form-data'
        )

        assert resp.status_code == 200
        mock_search.assert_called_once_with(
            index_id=FILE_INDEX_ID,
            search_term='B*3',
            offset=(1 - 1) * 10,
            limit=10,
            text_fields=text_fields,
            text_field_boosts=text_field_boosts,
            keyword_fields=keyword_fields,
            keyword_field_boosts=keyword_field_boosts,
            use_synonyms=True,
            query_filter={
                'bool': {
                    'must': [
                        {
                            'terms': {
                                'mime_type': [
                                    EnrichmentTableTypeProvider.MIME_TYPE,
                                    MapTypeProvider.MIME_TYPE,
                                    PDFTypeProvider.MIME_TYPE,
                                ]
                            }
                        },
                        {
                            'bool': {
                                'should': [
                                    {'terms': {'project_id': [fix_project.id]}},
                                    {'term': {'public': True}}
                                ]
                            }
                        }
                    ]
                }
            },
            highlight=highlight
        )
