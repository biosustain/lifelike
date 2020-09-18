import base64
import itertools
import json
import logging

from elasticsearch.helpers import parallel_bulk
from flask import current_app
from sqlalchemy.orm import joinedload
from typing import (
    Dict,
    List
)

from neo4japp.database import db
from neo4japp.models import (
    Directory,
    Files,
    Project
)
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

ELASTIC_INDEX_SEED_PAIRS = [
    ('file', '/home/n4j/neo4japp/services/indexing/mappings/document_idx.json'),
]
ELASTIC_PIPELINE_SEED_PAIRS = [
    ('attachment', '/home/n4j/neo4japp/services/indexing/pipelines/attachments_pipeline.json'),
]


class ElasticIndexService():
    def __init__(self, elastic):
        self.elastic_client = elastic

    def update_or_create_index(self, index_id, index_mapping_file):
        """Creates an index with the given index id and mapping file. If the index already exists,
        we update it and re-index any documents using that index."""
        with open(index_mapping_file) as f:
            index_definition_data = f.read()
        index_definition = json.loads(index_definition_data)

        if self.elastic_client.indices.exists(index_id):
            # Here, we actually delete the index and re-create it. The reason for this is that, if
            # we update the type of a field in the index, elastic will complain and fail to update
            # the index. So to prevent this from happening, we just trash the index and re-create
            # it.
            logging.info(f'Deleting and re-creating ElasticSearch index {index_id}')
            self.elastic_client.indices.delete(index=index_id)
            self.elastic_client.indices.create(index=index_id, body=index_definition)

            # But, if we trash the index we also need to re-index all the documents that used it.
            # Currently we take the safe route and simply re-index ALL documents, regardless of
            # which index was actually re-created.
            logging.info(f'Re-indexing documents with ElasticSearch index {index_id}')
            self.reindex_all_documents()
        else:
            logging.info(f'Created new ElasticSearch index {index_id}')
            self.elastic_client.indices.create(index=index_id, body=index_definition)

    def update_or_create_pipeline(self, pipeline_id, pipeline_definition_file):
        """Creates a pipeline with the given pipeline id and definition file. If the pipeline
        already exists, we update it."""
        with open(pipeline_definition_file) as f:
            pipeline_definition = f.read()
        pipeline_definition_json = json.loads(pipeline_definition)
        self.elastic_client.ingest.put_pipeline(id=pipeline_id, body=pipeline_definition_json)
        logging.info(f'Created or updated ElasticSearch pipeline {pipeline_id}')

    def recreate_indices_and_pipelines(self):
        """Recreates all currently defined Elastic pipelines and indices. If any indices/pipelines
        do not exist, we create them here. If an index/pipeline does exist, we update it."""
        for (pipeline_id, pipeline_definition_file) in ELASTIC_PIPELINE_SEED_PAIRS:
            self.update_or_create_pipeline(pipeline_id, pipeline_definition_file)

        for (index_id, index_mapping_file) in ELASTIC_INDEX_SEED_PAIRS:
            self.update_or_create_index(index_id, index_mapping_file)

    def delete_documents_with_index(self, file_ids: List[str], index_id: str):
        """
        Deletes all documents with the given ids from Elastic.

        NOTE: These ids are NOT the ids of the postgres rows! They are typically the id the
        user has visibility on, e.g. `file_id` or `hash_id`.
        """
        for success, info in parallel_bulk(
                self.elastic_client,
                ({'_op_type': 'delete', '_index': index_id, '_id': f_id} for f_id in file_ids)):  # noqa
            if not success:
                current_app.logger.error(
                    info,
                    extra=EventLog(event_type='elastic indexing').to_dict())
        self.elastic_client.indices.refresh(index_id)

    # TODO: Eventually `index_files` and `index_maps` will be the same service.
    # We could also eventually implement a generic "reindex_thing" service, but
    # this might be difficult because to _get_ the data we want to index we
    # typically have to do joins across multiple tables.

    def index_files(self, file_ids: List[int] = None, batch_size: int = None):
        """Adds the files with the given ids to Elastic. If no ids are given, adds all files."""

        if batch_size is None:
            batch_size = 100

        query = db.session.query(
            Files
        ).options(
            joinedload(Files.content),
            joinedload(Files.user),
            joinedload(Files.dir).joinedload(Directory.project)
        ).enable_eagerloads(False)

        if file_ids:
            query = query.filter(Files.id.in_(file_ids))

        results = iter(query.yield_per(batch_size))

        while True:
            batch = list(itertools.islice(results, batch_size))
            if not batch:
                break

            documents = []

            for file in batch:
                documents.append({
                    '_index': 'file',
                    'pipeline': 'attachment',
                    # '_type': 'doc',
                    '_id': file.file_id,
                    '_source': {
                        'filename': file.filename,
                        'description': file.description,
                        'uploaded_date': file.creation_date,
                        'data': base64.b64encode(file.content.raw_file).decode('utf-8'),
                        'user_id': file.user_id,
                        'username': file.user.username,
                        'project_id': file.project,
                        'project_name': file.project_.project_name,
                        'doi': file.doi,
                        'public': False,  # TODO: Once we can determine if a file is public, we need to change this
                        'id': file.file_id,
                        'type': 'pdf'
                    }
                })

            for success, info in parallel_bulk(self.elastic_client, documents):
                if not success:
                    logger.warning('Failed to index document in ES: {}'.format(info))

    def index_maps(self, map_ids: List[int] = None, batch_size: int = None):
        """Adds the maps with the given ids to Elastic. If no ids are given, adds all maps."""

        if batch_size is None:
            batch_size = 100

        query = db.session.query(
            Project
        ).options(
            joinedload(Project.user),
            joinedload(Project.dir).joinedload(Directory.project)
        ).enable_eagerloads(False)

        if map_ids:
            query = query.filter(Project.id.in_(map_ids))

        results = iter(query.yield_per(batch_size))

        while True:
            batch = list(itertools.islice(results, batch_size))
            if not batch:
                break

            documents = []

            for map in batch:
                map_data: Dict[str, List[Dict[str, str]]] = {'nodes': [], 'edges': []}

                for node in map.graph['nodes']:
                    map_data['nodes'].append(
                        {
                            'label': node.get('label', ''),
                            'display_name': node.get('display_name', ''),
                            'detail': node.get('detail', ''),
                        }
                    )

                for edge in map.graph['edges']:
                    edge_data = edge.get('data', '')
                    map_data['edges'].append(
                        {
                            'label': edge.get('label', ''),
                            'detail': edge_data.get('detail', '') if edge_data else '',
                        }
                    )

                map_data_bstr = json.dumps(map_data).encode('utf-8')

                documents.append({
                    '_index': 'file',
                    # '_type': 'doc',
                    'pipeline': 'attachment',
                    '_id': map.hash_id,
                    '_source': {
                        'filename': map.label,
                        'description': map.description,
                        'uploaded_date': map.creation_date,
                        'data': base64.b64encode(map_data_bstr).decode('utf-8'),
                        'user_id': map.user_id,
                        'username': map.user.username,
                        'project_id': map.dir.projects_id,
                        'project_name': map.dir.project.project_name,
                        'doi': None,
                        'public': False,  # TODO: Once we can determine if a file is public, we need to change this
                        'id': map.hash_id,
                        'type': 'map'
                    }
                })

            for success, info in parallel_bulk(self.elastic_client, documents):
                if not success:
                    logger.warning('Failed to index document in ES: {}'.format(info))

    def reindex_all_documents(self):
        self.index_files()
        self.index_maps()


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
                'pipeline': pdf_index.pipeline_id,
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
    ''' Seeds elasticsearch with existing file metadata '''
    pdf_index.create_or_update_pipeline()
    pdf_index.create_or_update_index()
    populate_index()
    pdf_index.refresh()
