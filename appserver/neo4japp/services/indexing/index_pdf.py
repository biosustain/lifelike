import base64
import itertools
import json
import logging
import os

from elasticsearch import Elasticsearch
from elasticsearch.helpers import parallel_bulk
from sqlalchemy.orm import joinedload

from neo4japp.database import db
from neo4japp.models import Files, Directory

FRAGMENT_SIZE = 2147483647
PDF_MAPPING = '/home/n4j/neo4japp/services/indexing/mappings/pdf_snippets.json'
ATTACHMENT_PIPELINE = '/home/n4j/neo4japp/services/indexing/pipelines/attachments_pipeline.json'
ATTACHMENT_PIPELINE_NAME = 'attachment'

logger = logging.getLogger(__name__)

elastic_client = Elasticsearch(timeout=180, hosts=[os.environ.get('ELASTICSEARCH_HOSTS')])


def create_ingest_pipeline():
    with open(ATTACHMENT_PIPELINE) as f:
        pipeline_definition = f.read()
    pipeline_definition_json = json.loads(pipeline_definition)
    elastic_client.ingest.put_pipeline(id='attachment', body=pipeline_definition_json)
    print('Ingest Pipeline created.')


def create_index_and_mappings():
    if not elastic_client.indices.exists('pdf'):
        with open(PDF_MAPPING) as f:
            index_definition = f.read()
        index_definition_json = json.loads(index_definition)
        elastic_client.indices.create(index='pdf', body=index_definition_json)
        print('Index created')


def populate_index(pk: int = None, batch_size=100):
    query = db.session.query(Files) \
        .options(joinedload(Files.content),
                 joinedload(Files.user),
                 joinedload(Files.dir).joinedload(Directory.project)) \
        .enable_eagerloads(False)

    if pk is not None:
        query = query.filter(Files.id == pk)

    results = iter(query.yield_per(batch_size))

    while True:
        batch = list(itertools.islice(results, batch_size))
        if not batch:
            break

        documents = []

        for file in batch:  # type: Files
            documents.append({
                '_index': 'pdf',
                'pipeline': ATTACHMENT_PIPELINE_NAME,
                '_id': file.file_id,
                '_source': {
                    'id': file.file_id,
                    'data': base64.b64encode(file.content.raw_file).decode('utf-8'),
                    'filename': file.filename,
                    'description': file.description,
                    'internal_link': file.file_id,
                    'uploaded_date': file.creation_date,
                    'external_link': file.upload_url,
                    'email': file.user.email,
                    'doi': file.doi,
                    'project_id': file.project_.id,
                    'project_directory': file.project_.project_name,
                }
            })

        for success, info in parallel_bulk(elastic_client, documents):
            if not success:
                logger.warning('Failed to index document in ES: {}'.format(info))


def populate_single_index(fid: int):
    populate_index(fid)


def populate_all_indexes():
    populate_index(None)


def seed_elasticsearch():
    """ Seeds elasticsearch with existing file metadata """
    create_ingest_pipeline()
    create_index_and_mappings()
    populate_all_indexes()
    elastic_client.indices.refresh('pdf')
