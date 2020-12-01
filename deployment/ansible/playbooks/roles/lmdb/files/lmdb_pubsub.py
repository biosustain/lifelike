#!/usr/bin/env python3

""" Script used to automatically download new
LMDB files to a virtual machine. Script also
updates the RDBMS LMDBsDates table whenever
a new download is triggered.

Sequence of events
(1) Google Cloud Storage Bucket gets updated
(2) PubSub sends signal to Google Compute Engine (GCE)
(3) Script downloads new file from Google Cloud Storage to GCE
(4) Script updates Google Cloud SQL with new LMDB modified date
"""

import httplib2
import logging
import os
import urllib.request
import sqlalchemy
import time
from datetime import datetime
from apiclient import discovery
from apiclient.errors import HttpError
from google.cloud import storage as gcp_storage
from google.cloud.storage.blob import Blob
from oauth2client.client import GoogleCredentials
from sqlalchemy import Column, String
from sqlalchemy.types import TIMESTAMP
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

logging.basicConfig(level=logging.DEBUG)
log = logging.getLogger(__name__)

# Used to check on the health of this script
health_check_url = os.environ.get('HEALTHCHECK_URL')

class GCPStorage:
    """ Allows for interacting with GCP Cloud Storage Bucket(s) """

    def __init__(self, bucket_name='lmdb_database'):
        self.storage_client = gcp_storage.Client()
        self.bucket = self.storage_client.get_bucket(bucket_name)

    def download(self, target_path, dest_path):
        """ Downloads file to destination """
        blob = Blob(target_path, self.bucket)

        base_dest_path, dest_filename = os.path.split(dest_path)
        if not dest_filename:
            raise IOError('Full destination path to file required. (e.g. my/file/path.txt)')

        if base_dest_path and not os.path.isdir(base_dest_path):
            os.makedirs(base_dest_path)

        with open(dest_path, 'wb') as file_obj:
            blob.download_to_file(file_obj)
            log.debug(f'Saving file <{dest_filename}> to <{dest_path}>')

class PubSub:
    """ Interacts with the Pub/Sub service on GCP
    to send a message to Google Compute Engine
    whenever a specified Google Cloud Storage Bucket
    has it's content updated

    Example usage:
    1. user uploads new content on bucket
    2. subscriber on compute engine watches for new content
    3. subscriber on compute engine performs a custom
    action in response to event(s) in (2)
    """

    def __init__(
        self,
        topic='lmdb',
        project='able-goods-221820',
        subname='lmdb-sub',
        scope=None,
        deadline=60,
    ):
        self.topic = topic
        self.project = project
        self.subname = f'{topic}_{subname}'
        self.pub_scopes = scope if scope else ['https://www.googleapis.com/auth/pubsub']
        self.client = self.get_client()
        self.sub = self.get_subscription(deadline=deadline)
        self.ackdeadline = self.sub['ackDeadlineSeconds']
        self.lease_start = None

    def get_client(self):
        cred = GoogleCredentials.get_application_default()
        cred = cred.create_scoped(self.pub_scopes)
        http = httplib2.Http()
        cred.authorize(http)
        return discovery.build('pubsub', 'v1beta2', http=http)

    def create_subscription(self, deadline=60):
        log.debug('Creating subscription...')
        body = {
            'topic': f'projects/{self.project}/topics/{self.topic}',
            'ackDeadlineSeconds': deadline,
        }
        try:
            subscription = self.client.projects().subscriptions().create(
                name=f'projects/{self.project}/subscriptions/{self.subname}',
                body=body
            ).execute()
            return subscription
        except Exception as e:
            log.critical(f'Unable to create subscription <{e}>')

    def get_subscription(self, deadline=60):
        sub = None
        log.debug('Getting subscription...')
        try:
            self.client.projects().subscriptions().delete(
                subscription=f'projects/{self.project}/subscriptions/{self.subname}'
            ).execute()
            log.debug('Deleted existing subscription...')
        except HttpError as e:
            if e.resp.status == 404:
                sub = self.create_subscription(deadline=deadline)
            else:
                raise
        else:
            sub = self.create_subscription(deadline=deadline)
            log.debug(f'Subscription: {sub}')
        return sub

    def get_message(self, batch_size=1):
        body = {
            'returnImmediately': True,
            'maxMessages': batch_size,
        }
        log.debug(f'Pulling messages...')
        resp = self.client.projects().subscriptions().pull(
            subscription=self.sub['name'],
            body=body,
        ).execute()
        if 'receivedMessages' in resp:
            log.debug(f'Number of msgs: {resp.get("receivedMessages")}')
            self.lease_start = datetime.now()
            return resp.get('receivedMessages')
        else:
            return []


    def process_messages(self, msgs, handler=None):
        for received_message in msgs:
            pubsub_message = received_message.get('message')
            log.debug(f'Processing: {received_message.get("ackId")}')
            if pubsub_message:
                ack_ids = []
                ack_ids.append(received_message.get('ackId'))
                ack_body = {'ackIds': ack_ids}
                if ack_ids:
                    log.debug(f'Acknowledging {ack_ids}')
                    if handler is None:
                        handler = lambda msg: msg
                    handler(received_message)
                    self.client.projects().subscriptions().acknowledge(
                        subscription=self.sub['name'],
                        body=ack_body
                    ).execute()

    def watch_topic(self, handler=None):
        # Send initial ping
        urllib.request.urlopen(health_check_url, timeout=10)
        old_time = time.time()
        while True:
            # Send a request every hour to confirm script still runs
            if time.time() - old_time > 3599:
                old_time = time.time()
                urllib.request.urlopen(health_check_url, timeout=10)
            msgs = self.get_message()
            if msgs:
                self.process_messages(msgs, handler)


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


Base = declarative_base()
class LMDBsDates(Base):
    __tablename__ = 'lmdbs_dates'
    name = Column(String, primary_key=True)
    date = Column(TIMESTAMP(timezone=True), nullable=False)

    def __repr__(self):
        return f'<LMDBsDates(name={self.name}:updated={self.date})>'


def update_lmdb_date(db_name):
    """ Updates the LMDB dates RDBMS table to match
    the dates on the Google Cloud Storage """
    session = init_database_connection()
    lmdb_db = session.query(LMDBsDates).filter_by(name=db_name).one_or_none()
    if lmdb_db is None:
        lmdb_db = LMDBsDates(name=db_name, date=datetime.utcnow())
        session.add(lmdb_db)
        session.commit()
    gcp_storage = GCPStorage()
    gcp_bucket_path = f'{db_name}/data.mdb'
    gcp_bucket_blob = gcp_storage.bucket.get_blob(gcp_bucket_path)
    sql_last_updated = lmdb_db.date
    if gcp_bucket_blob.updated != sql_last_updated:
        log.debug(f'Updating LMDB: {db_name} date')
        session.query(
            LMDBsDates
        ).filter(
            LMDBsDates.name == db_name
        ).update({LMDBsDates.date: gcp_bucket_blob.updated})
        session.commit()
    else:
        log.debug(f'LMDB database {db_name} is already up to date.')

def download_lmdb(dest_path='./lmdb'):
    """ Downloads the latest lmdb files

    NOTE: This relies on the folder structure for the gcp storage to be
    bucket_name/category/data.mdb
    """
    gcp_storage = GCPStorage()
    def handler(msg):
        # eventType is a GCP Cloud Storage event type
        # objectId is the file object name; trailing '/' indicates a directory
        msg = msg['message']['attributes']
        if msg['eventType'] == 'OBJECT_FINALIZE' and not msg['objectId'].endswith('/'):
            save_path = os.path.join(dest_path, msg['objectId'])
            # create directories if it does not exist
            if not os.path.isdir(os.path.dirname(save_path)):
                os.makedirs(os.path.dirname(save_path))
            gcp_storage.download(msg['objectId'], save_path)
            # update the lmdb update table
            lmdb_category = os.path.dirname(msg['objectId'])
            update_lmdb_date(lmdb_category)
    return handler

def main():
    pubsub = PubSub()
    pubsub.watch_topic(download_lmdb())

main()
