import os

from elasticsearch import AsyncElasticsearch
from elasticsearch.helpers import async_streaming_bulk
from typing import Dict, List

from .constants import ATTACHMENT_PIPELINE_ID, FILE_INDEX_ID
from .logs import get_logger

logger = get_logger()


def _get_elasticsearch_conxn():
    logger.info('Acquiring Elasticsearch connection...')
    conxn = AsyncElasticsearch(
        timeout=180,
        hosts=[os.environ.get('ELASTICSEARCH_HOSTS')]
    )
    logger.info('Successfully connected to Elastic!')
    return conxn


async def streaming_bulk_update_files(updates: Dict[str, dict]):
    elastic_client = _get_elasticsearch_conxn()

    await _streaming_bulk_documents(
        elastic_client,
        [
            _get_update_action_obj(hash_id, update, FILE_INDEX_ID)
            for hash_id, update in updates.items()
        ]
    )
    logger.info(f'Update actions successfully sent to Elastic. Refreshing index {FILE_INDEX_ID}')
    elastic_client.indices.refresh(FILE_INDEX_ID)


async def streaming_bulk_delete_files(file_hash_ids: List[str]):
    elastic_client = _get_elasticsearch_conxn()

    await _streaming_bulk_documents(
        elastic_client,
        [_get_delete_obj(hash_id, FILE_INDEX_ID) for hash_id in file_hash_ids]
    )
    logger.info(f'Delete actions successfully sent to Elastic. Refreshing index {FILE_INDEX_ID}')
    elastic_client.indices.refresh(FILE_INDEX_ID)


async def streaming_bulk_index_files(sources: Dict[str, dict]):
    elastic_client = _get_elasticsearch_conxn()

    await _streaming_bulk_documents(
        elastic_client,
        [_get_index_obj(hash_id, source, FILE_INDEX_ID) for hash_id, source in sources.items()]
    )
    logger.info(f'Index actions successfully sent to Elastic. Refreshing index {FILE_INDEX_ID}')
    elastic_client.indices.refresh(FILE_INDEX_ID)


def _get_index_obj(file_hash_id: str, source: dict, index_id) -> dict:
    """
    Generate an index operation object from the given file and project
    :param file: the file
    :param project: the project that file is within
    :param index_id: the index
    :return: a document
    """
    return {
        '_index': index_id,
        'pipeline': ATTACHMENT_PIPELINE_ID,
        '_id': file_hash_id,
        '_source': source
    }


def _get_update_action_obj(file_hash_id: str, changes: dict, index_id: str) -> dict:
    return {
        '_op_type': 'update',
        '_index': index_id,
        'pipeline': ATTACHMENT_PIPELINE_ID,
        '_id': file_hash_id,
        'doc': changes,
    }


def _get_delete_obj(file_hash_id: str, index_id: str) -> dict:
    return {
        '_op_type': 'delete',
        '_index': index_id,
        '_id': file_hash_id
    }


async def _streaming_bulk_documents(elastic_client: AsyncElasticsearch, documents):
    """
    Performs a series of bulk operations in elastic, determined by the `documents` input.
    These operations are done in series.
    """
    async def gendata():
        for doc in documents:
            yield doc

    # `raise_on_exception` set to False so that we don't error out if one of the documents
    # fails to index
    async for success, info in async_streaming_bulk(
        client=elastic_client,
        actions=gendata(),
        max_retries=5,
        raise_on_error=False,
        raise_on_exception=False
    ):
        if success:
            logger.info(f'Elasticsearch bulk operation succeeded: {info}')
        else:
            logger.warning(f'Elasticsearch bulk operation failed: {info}')
