import base64
import pytest

from neo4japp.constants import FILE_INDEX_ID, FRAGMENT_SIZE
from neo4japp.services.elastic.constants import ATTACHMENT_PIPELINE_ID


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
        'number_of_fragments': 200,
    }


@pytest.fixture(scope='function')
def query_filter_map():
    return {
        'bool': {
            'must': [
                {'terms': {'type': ['map']}},
            ]
        }
    }


@pytest.fixture(scope='function')
def query_filter_pdf():
    return {
        'bool': {
            'must': [
                {'terms': {'type': ['pdf']}},
            ]
        }
    }


@pytest.fixture(scope='function')
def query_filter_map_and_pdf():
    return {
        'bool': {
            'must': [
                {'terms': {'type': ['map', 'pdf']}},
            ]
        }
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


@pytest.fixture(scope='function')
def pdf_document(elastic_service):
    elastic_service.elastic_client.create(
        index=FILE_INDEX_ID,
        pipeline=ATTACHMENT_PIPELINE_ID,
        id='1',
        body={
            'filename': 'test_pdf',
            'description': 'mock pdf document for testing elasticsearch',
            'uploaded_date': None,
            'data': base64.b64encode('BOLA3'.encode('utf-8')).decode('utf-8'),
            'user_id': 1,
            'username': 'test_user',
            'project_id': 1,
            'project_name': 'test-project',
            'doi': None,
            'public': True,
            'id': '1',
            'type': 'pdf'
        },
        # This option is MANDATORY! Otherwise the document won't be immediately visible to search.
        refresh='true'
    )


@pytest.fixture(scope='function')
def map_document(elastic_service):
    elastic_service.elastic_client.create(
        index=FILE_INDEX_ID,
        pipeline=ATTACHMENT_PIPELINE_ID,
        id='2',
        body={
            'filename': 'test_map',
            'description': 'mock map document for testing elasticsearch',
            'uploaded_date': None,
            'data': base64.b64encode('COVID'.encode('utf-8')).decode('utf-8'),
            'user_id': 1,
            'username': 'test_user',
            'project_id': 1,
            'project_name': 'test-project',
            'doi': None,
            'public': True,
            'id': '2',
            'type': 'pdf'
        },
        # This option is MANDATORY! Otherwise the document won't be immediately visible to search.
        refresh='true'
    )


@pytest.mark.skip(reason='Skipping until Neo4j container is updated')
def test_should_not_get_results_from_empty_db(
    elastic_service,
    highlight,
    query_filter_map_and_pdf,
    text_fields,
    text_field_boosts,
    keyword_fields,
    keyword_field_boosts,
):
    res, _, _ = elastic_service.search(
        index_id=FILE_INDEX_ID,
        search_term='BOLA3',
        offset=0,
        limit=1,
        text_fields=text_fields,
        text_field_boosts=text_field_boosts,
        keyword_fields=keyword_fields,
        keyword_field_boosts=keyword_field_boosts,
        use_synonyms=True,
        query_filter=query_filter_map_and_pdf,
        highlight=highlight
    )
    res = res['hits']['hits']

    assert len(res) == 0


@pytest.mark.skip(reason='Skipping until Neo4j container is updated')
def test_can_get_results_from_pdf(
    elastic_service,
    pdf_document,
    highlight,
    query_filter_map_and_pdf,
    text_fields,
    text_field_boosts,
    keyword_fields,
    keyword_field_boosts,
):
    res, _, _ = elastic_service.search(
        index_id=FILE_INDEX_ID,
        search_term='BOLA3',
        offset=0,
        limit=1,
        text_fields=text_fields,
        text_field_boosts=text_field_boosts,
        keyword_fields=keyword_fields,
        keyword_field_boosts=keyword_field_boosts,
        use_synonyms=True,
        query_filter=query_filter_map_and_pdf,
        highlight=highlight
    )

    res = res['hits']['hits']

    assert len(res) > 0


@pytest.mark.skip(reason='Skipping until Neo4j container is updated')
def test_can_get_results_from_pdf_with_asterisk_wildcard_phrase(
    elastic_service,
    pdf_document,
    highlight,
    query_filter_map_and_pdf,
    text_fields,
    text_field_boosts,
    keyword_fields,
    keyword_field_boosts,
):
    res, _, _ = elastic_service.search(
        index_id=FILE_INDEX_ID,
        search_term='BO*A3',
        offset=0,
        limit=1,
        text_fields=text_fields,
        text_field_boosts=text_field_boosts,
        keyword_fields=keyword_fields,
        keyword_field_boosts=keyword_field_boosts,
        use_synonyms=True,
        query_filter=query_filter_map_and_pdf,
        highlight=highlight
    )
    res = res['hits']['hits']

    assert len(res) > 0


@pytest.mark.skip(reason='Skipping until Neo4j container is updated')
def test_can_get_results_from_pdf_with_question_mark_wildcard_phrase(
    elastic_service,
    pdf_document,
    highlight,
    query_filter_map_and_pdf,
    text_fields,
    text_field_boosts,
    keyword_fields,
    keyword_field_boosts,
):
    res, _, _ = elastic_service.search(
        index_id=FILE_INDEX_ID,
        search_term='BO?A3',
        offset=0,
        limit=1,
        text_fields=text_fields,
        text_field_boosts=text_field_boosts,
        keyword_fields=keyword_fields,
        keyword_field_boosts=keyword_field_boosts,
        use_synonyms=True,
        query_filter=query_filter_map_and_pdf,
        highlight=highlight
    )
    res = res['hits']['hits']

    assert len(res) > 0


@pytest.mark.skip(reason='Skipping until Neo4j container is updated')
def test_can_get_results_from_map(
    elastic_service,
    map_document,
    highlight,
    query_filter_map_and_pdf,
    text_fields,
    text_field_boosts,
    keyword_fields,
    keyword_field_boosts,
):
    res, _, _ = elastic_service.search(
        index_id=FILE_INDEX_ID,
        search_term='COVID',
        offset=0,
        limit=1,
        text_fields=text_fields,
        text_field_boosts=text_field_boosts,
        keyword_fields=keyword_fields,
        keyword_field_boosts=keyword_field_boosts,
        use_synonyms=True,
        query_filter=query_filter_map_and_pdf,
        highlight=highlight
    )
    res = res['hits']['hits']

    assert len(res) > 0


@pytest.mark.skip(reason='Skipping until Neo4j container is updated')
def test_can_get_results_from_map_with_wildcard_phrase(
    elastic_service,
    map_document,
    highlight,
    query_filter_map_and_pdf,
    text_fields,
    text_field_boosts,
    keyword_fields,
    keyword_field_boosts,
):
    res, _, _ = elastic_service.search(
        index_id=FILE_INDEX_ID,
        search_term='CO*ID',
        offset=0,
        limit=1,
        text_fields=text_fields,
        text_field_boosts=text_field_boosts,
        keyword_fields=keyword_fields,
        keyword_field_boosts=keyword_field_boosts,
        use_synonyms=True,
        query_filter=query_filter_map_and_pdf,
        highlight=highlight
    )
    res = res['hits']['hits']

    assert len(res) > 0


@pytest.mark.skip(reason='Skipping until Neo4j container is updated')
def test_can_get_results_with_quoted_phrase(
    elastic_service,
    map_document,
    highlight,
    query_filter_map_and_pdf,
    text_fields,
    text_field_boosts,
    keyword_fields,
    keyword_field_boosts,
):
    res, _, _ = elastic_service.search(
        index_id=FILE_INDEX_ID,
        search_term='"mock map document"',
        offset=0,
        limit=1,
        text_fields=text_fields,
        text_field_boosts=text_field_boosts,
        keyword_fields=keyword_fields,
        keyword_field_boosts=keyword_field_boosts,
        use_synonyms=True,
        query_filter=query_filter_map_and_pdf,
        highlight=highlight
    )
    res = res['hits']['hits']

    assert len(res) > 0


@pytest.mark.skip(reason='Skipping until Neo4j container is updated')
def test_using_wildcard_in_phrase_does_not_work(
    elastic_service,
    pdf_document,
    highlight,
    query_filter_map_and_pdf,
    text_fields,
    text_field_boosts,
    keyword_fields,
    keyword_field_boosts,
):
    res, _, _ = elastic_service.search(
        index_id=FILE_INDEX_ID,
        search_term='"BO*A3"',
        offset=0,
        limit=1,
        text_fields=text_fields,
        text_field_boosts=text_field_boosts,
        keyword_fields=keyword_fields,
        keyword_field_boosts=keyword_field_boosts,
        use_synonyms=True,
        query_filter=query_filter_map_and_pdf,
        highlight=highlight
    )

    res = res['hits']['hits']

    assert len(res) == 0
