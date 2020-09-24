import logging
from typing import List

from elasticsearch.helpers import parallel_bulk
from flask import current_app

from neo4japp.services.indexing.common import ElasticIndex, elastic_client
from neo4japp.utils import EventLog

logger = logging.getLogger(__name__)

INGEST_PIPELINE_MAPPING = '/home/n4j/neo4japp/services/indexing/pipelines/attachments_pipeline.json'
SNIPPET_INDEX_MAPPING = '/home/n4j/neo4japp/services/indexing/mappings/pdf_snippets.json'

pdf_index = ElasticIndex(
    index_id='pdf',
    index_definition_file=SNIPPET_INDEX_MAPPING,
    pipeline_id='attachment',
    pipeline_definition_file=INGEST_PIPELINE_MAPPING
)


def populate_index(pk: int = None, batch_size=100):
    pass # TODO


def populate_single_index(fid: int):
    populate_index(fid)


def delete_indices(file_ids: List[str]):
    for success, info in parallel_bulk(
            elastic_client,
            ({'_op_type': 'delete', '_index': 'pdf', '_id': f_id} for f_id in file_ids)):  # noqa
        if not success:
            current_app.logger.error(
                info,
                extra=EventLog(event_type='elastic indexing').to_dict())
    elastic_client.indices.refresh('pdf')


def seed_elasticsearch():
    """ Seeds elasticsearch with existing file metadata """
    pdf_index.create_or_update_pipeline()
    pdf_index.create_or_update_index()
    populate_index()
    pdf_index.refresh()
