import json
import logging
import os

from elasticsearch import Elasticsearch

logger = logging.getLogger(__name__)

elastic_client = Elasticsearch(timeout=180, hosts=[os.environ.get('ELASTICSEARCH_HOSTS')])


class ElasticIndex:
    def __init__(self, index_id: str,
                 index_definition_file: str,
                 pipeline_id: str,
                 pipeline_definition_file: str):
        self.index_id = index_id
        self.index_definition_file = index_definition_file
        self.pipeline_id = pipeline_id
        self.pipeline_definition_file = pipeline_definition_file

    def create_or_update_index(self):
        with open(self.index_definition_file) as f:
            index_definition_data = f.read()
        index_definition = json.loads(index_definition_data)

        if not elastic_client.indices.exists(self.index_id):
            logging.info(f"Created new ElasticSearch index {self.index_id}")
            elastic_client.indices.create(index=self.index_id, body=index_definition)

        # TODO: There's no migration support (!!)

    def create_or_update_pipeline(self):
        with open(self.pipeline_definition_file) as f:
            pipeline_definition = f.read()
        pipeline_definition_json = json.loads(pipeline_definition)
        elastic_client.ingest.put_pipeline(id=self.pipeline_id, body=pipeline_definition_json)
        logging.info(f"Created or updated ElasticSearch pipeline {self.index_id}")

    def refresh(self):
        elastic_client.indices.refresh(self.index_id)
