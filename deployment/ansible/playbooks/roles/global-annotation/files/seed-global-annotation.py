import argparse
import json
import os
import sqlalchemy
from collections import deque
from elasticsearch import Elasticsearch
from elasticsearch.helpers import parallel_bulk
from sqlalchemy import Boolean, Column, ForeignKey, Integer, String
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base


parser = argparse.ArgumentParser(
    description='Update Elasticsearch/Kibana with Global Inclusion/Exclusion')
parser.add_argument(
    '--db',
    help='database environment',
    choices=['qa', 'staging', 'production'],
    required=True,
)
args = parser.parse_args()


es = Elasticsearch(hosts=[os.environ['ELASTICSEARCH_HOSTS']], timeout=5000)


def init_db_connection():
    POSTGRES_HOST = os.environ['POSTGRES_HOST']
    POSTGRES_PORT = os.environ['POSTGRES_PORT']
    POSTGRES_USER = os.environ['POSTGRES_USER']
    POSTGRES_PASSWORD = os.environ['POSTGRES_PASSWORD']
    POSTGRES_DB = os.environ['POSTGRES_DB']

    engine = sqlalchemy.create_engine(
        sqlalchemy.engine.url.URL(
            drivername='postgres+psycopg2',
            username=POSTGRES_USER,
            password=POSTGRES_PASSWORD,
            host=POSTGRES_HOST,
            port=POSTGRES_PORT,
            database=POSTGRES_DB,
        )
    )
    Session = sessionmaker(bind=engine)
    session = Session()
    return session


Base = declarative_base()


class GlobalList(Base):  # type: ignore
    __tablename__ = 'global_list'
    id = Column(Integer, primary_key=True)
    annotation = Column(postgresql.JSON, nullable=False)
    type = Column(String(12), nullable=False)
    file_id = Column(Integer, ForeignKey('files_content.id'))
    reviewed = Column(Boolean, default=False)
    approved = Column(Boolean, default=False)


def create_indexes(global_list, exclusion_index, inclusion_index):
    # Make sure there are inclusion/exclusions before indexing
    for i, gl in enumerate(global_list):
        if gl.type == 'inclusion' and gl.annotation['meta'].get('allText') is not None:
            yield {
                '_id': i+1,
                '_index': inclusion_index,
                '_source': {
                    'id': i+1,
                    'word': gl.annotation['meta']['allText'],
                }
            }
        elif gl.type == 'exclusion' and gl.annotation.get('text') is not None:
            yield {
                '_id': i+1,
                '_index': exclusion_index,
                '_source': {
                    'id': i+1,
                    'word': gl.annotation['text'],
                }
            }


def seed_global_annotations(session):
    annotations = session.query(GlobalList).all()
    exclusion_index_name = f'{args.db}_annotation_exclusion'
    inclusion_index_name = f'{args.db}_annotation_inclusion'
    es.indices.delete(index=exclusion_index_name, ignore=[404])
    es.indices.delete(index=inclusion_index_name, ignore=[404])
    print(f'Creating indexes: <{exclusion_index_name}> and <{inclusion_index_name}>')  # noqa
    es.indices.create(index=exclusion_index_name)
    es.indices.create(index=inclusion_index_name)
    deque(
        parallel_bulk(
            client=es,
            actions=create_indexes(
                annotations, exclusion_index_name, inclusion_index_name),
            chunk_size=500,
            max_chunk_bytes=10 * 1024 * 1024,
        ),
        maxlen=0,
    )


seed_global_annotations(init_db_connection())
print(f'Finish seeding global inclusion and exclusions for {args.db}')
