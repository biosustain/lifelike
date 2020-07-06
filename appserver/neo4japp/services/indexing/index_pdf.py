import base64
import json
import requests
from elasticsearch import Elasticsearch
from elasticsearch.helpers import parallel_bulk
from neo4japp.database import db
from neo4japp.factory import create_app
from neo4japp.models import Files, FileContent, AppUser

FRAGMENT_SIZE = 2147483647
PDF_MAPPING = 'mappings/pdf_snippets.json'
ATTACHMENT_PIPELINE = 'pipelines/attachments_pipeline.json'
ATTACHMENT_PIPELINE_NAME = 'attachment'
PDF_FOLDER = 'downloaded_files/'
ELASTICSEARCH_HOST = 'http://n4j-elasticsearch:9200'

elastic_client = Elasticsearch(hosts=[ELASTICSEARCH_HOST])


def ingest_pipeline_exists(pipeline_name):
    response = requests.get(f'{ELASTICSEARCH_HOST}/_ingest/pipeline/{pipeline_name}')
    return response.status_code == 404


def create_ingest_pipeline():
    ingest_pipeline = ingest_pipeline_exists(ATTACHMENT_PIPELINE_NAME)
    if not ingest_pipeline:
        with open(ATTACHMENT_PIPELINE) as f:
            pipeline_definition = f.read()
        pipeline_definition_json = json.loads(pipeline_definition)
        elastic_client.ingest.put_pipeline(id='attachment', body=pipeline_definition_json)
        print('Ingest Pipeline created.')
    print('Ingest Pipeline was updated.')


def create_index_and_mappings():
    if not elastic_client.indices.exists('pdf'):
        with open(PDF_MAPPING) as f:
            index_definition = f.read()
        index_definition_json = json.loads(index_definition)
        elastic_client.indices.create(index='pdf', body=index_definition_json)
        print('Index created')


def populate_index():
    documents = []
    entries = db.session \
        .query(Files.filename, Files.description, Files.file_id,
               Files.doi, Files.creation_date, Files.upload_url,
               Files.user_id, FileContent.raw_file) \
        .join(FileContent, FileContent.id == Files.content_id) \
        .all()
    for filename, description, file_id, doi, creation_date, \
            uploaded_url, user_id, file in entries:
        encoded_pdf = base64.b64encode(file)
        email = db.session.query(AppUser.email).filter(user_id == AppUser.id).one_or_none()
        data = encoded_pdf.decode('utf-8')
        document = {
            '_index': 'pdf',
            'pipeline': ATTACHMENT_PIPELINE_NAME,
            '_id': file_id,
            '_source': {
                'id': file_id,
                'data': data,
                'filename': filename,
                'description': description,
                'internal_link': file_id,
                'uploaded_date': creation_date,
                'external_link': uploaded_url,
                'email': email.email,
                'doi': doi
            }
        }
        documents.append(document)
    for success, info in parallel_bulk(elastic_client, documents):
        if not success:
            print(info)


def main():
    app = create_app('Test', config='config.Testing')
    with app.app_context():
        create_ingest_pipeline()
        create_index_and_mappings()
        populate_index()
        elastic_client.indices.refresh('pdf')


if __name__ == '__main__':
    main()
