#!/usr/bin/env python3
""" Used for updating LMDB Dates

The dates of the lmdb database files on google cloud storage (bucket)
is compared with the dates listed on the target Cloud SQL database.
The comparison is used to synchronize the dates with one another.

NOTE: This only updates the date to match the GCP storage to
that of the database. This does not pull in the appropriate files
to the application and the script should be used in conjunction
with another script to pull in the files for the application to use.
In this case, we use this script with Ansible and the "lmdb-setup.yml"
playbook to ensure the correct server gets the updated files.

"""

import os
import sqlalchemy
from datetime import datetime, timezone
from google.cloud import storage
from sqlalchemy import Column, String
from sqlalchemy.types import TIMESTAMP
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base


Base = declarative_base()


class LMDBsDates(Base):  # type: ignore
    __tablename__ = 'lmdbs_dates'
    name = Column(String, primary_key=True)
    date = Column(TIMESTAMP(timezone=True), nullable=False)

    def __repr__(self):
        return f'<LMDBsDates(name={self.name}:updated={self.date})>'


def init_gcp_storage_connection(bucket_name: str):
    """ Connects to Google Cloud Storage Bucket """
    storage_client = storage.Client()
    blobs = storage_client.list_blobs(bucket_name)
    return blobs


def init_database_connection():
    # Using Google Cloud Proxy, we set it to localhost
    POSTGRES_HOST = os.environ.get('POSTGRES_HOST')
    POSTGRES_PORT = os.environ.get('POSTGRES_PORT')
    POSTGRES_USER = os.environ.get('POSTGRES_USER')
    POSTGRES_PASSWORD = os.environ.get('POSTGRES_PASSWORD')
    POSTGRES_DB = os.environ.get('POSTGRES_DB')

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


def main():

    session = init_database_connection()
    cloud_sql_results = {
        l.name: l.date for l in session.query(LMDBsDates).all()}

    gcp_blobs = init_gcp_storage_connection('lmdb_database')
    data_blobs = [b for b in gcp_blobs if b.name.endswith('data.mdb')]
    for gcp_blob in data_blobs:
        lmdb_db_name = os.path.dirname(gcp_blob.name)
        if lmdb_db_name in cloud_sql_results:
            sql_last_updated = cloud_sql_results[lmdb_db_name]
            if gcp_blob.updated != sql_last_updated:
                print(f'Updating LMDB: {lmdb_db_name} date')
                session.query(
                    LMDBsDates
                ).filter(
                    LMDBsDates.name == lmdb_db_name
                ).update({LMDBsDates.date: gcp_blob.updated})
                session.commit()
            else:
                print(f'LMDB database {lmdb_db_name} is already up to date.')
        else:
            print(f'LMDB database {lmdb_db_name} does not exist in Cloud SQL.')


if __name__ == '__main__':
    main()
