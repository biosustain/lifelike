import base64
import json
import os

from elasticsearch import Elasticsearch
from elasticsearch.helpers import parallel_bulk
from neo4japp.database import db
from neo4japp.models import Files, FileContent, AppUser

FRAGMENT_SIZE = 2147483647
PDF_MAPPING = '/home/n4j/neo4japp/services/indexing/mappings/pdf_snippets.json'
ATTACHMENT_PIPELINE = '/home/n4j/neo4japp/services/indexing/pipelines/attachments_pipeline.json'
ATTACHMENT_PIPELINE_NAME = 'attachment'

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


def populate_single_index(fid: int):
    fi, fc = db.session.query(Files, FileContent).filter(Files.id == fid).join(FileContent).one()
    email = db.session.query(AppUser.email).filter(AppUser.id == fi.user_id).one()
    encoded_pdf = base64.b64encode(fc.raw_file)
    data = encoded_pdf.decode('utf-8')
    document = {
            'id': fi.file_id,
            'data': data,
            'filename': fi.filename,
            'description': fi.description,
            'internal_link': fi.file_id,
            'uploaded_date': fi.creation_date,
            'external_link': fi.upload_url,
            'email': email.email,
            'doi': fi.doi
        }
    elastic_client.create('pdf', id=fi.file_id, body=document, pipeline=ATTACHMENT_PIPELINE_NAME)
    elastic_client.indices.refresh('pdf')


def populate_all_indexes():
    documents = []
    entries = db.session.query(
        Files.filename,
        Files.description,
        Files.file_id,
        Files.doi,
        Files.creation_date,
        Files.upload_url,
        Files.user_id,
        FileContent.raw_file
    ).join(
        FileContent,
        FileContent.id == Files.content_id
    )
    for filename, description, file_id, doi, creation_date, \
            uploaded_url, user_id, file in entries.all():
        encoded_pdf = base64.b64encode(file)
        data = encoded_pdf.decode('utf-8')
        email = db.session.query(AppUser.email).filter(user_id == AppUser.id).one_or_none()
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


def seed_elasticsearch():
    """ Seeds elasticsearch with existing file metadata """
    create_ingest_pipeline()
    create_index_and_mappings()
    populate_all_indexes()
    elastic_client.indices.refresh('pdf')
