import base64
import logging
import hashlib
import json
import os
import sqlalchemy
from dataclasses import dataclass
from datetime import datetime
from google.cloud import storage as gcp_storage
from typing import Any, List, Dict, Optional
from sqlalchemy import Column, String
from sqlalchemy.types import TIMESTAMP
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base, DeclarativeMeta

logging.basicConfig(level=logging.DEBUG)
log = logging.getLogger(__name__)


class BaseCloudStorageProvider:
    """ Used to provide methods for interacting with cloud
    storages. (e.g. Azure, GCP, AWS) """

    def __init__(self, client: Any):
        """
        Attributes:
            client (object): represents an object that sets up the
            connection to the cloud. Usually cloud providers provide
            a library that will have the connection and pass back an
            object representing a connection.
        """
        self.client = client

    def download(self, storage_object: str, remote_object_path: str, dest_path: str):
        """
        Downloads a remote object to a local destination. Directories
        will be created if they do not exists in the local path.

        Args:
            storage_object (str): represents what cloud providers call
            the top level directory (e.g. all files will reside in a particular bucket).
            remote_object_path (str): represents the path to the remote object.
            dest_path (str): path string to save the file on local.
        """
        raise NotImplementedError()

    def get_file_date(self, storage_object: str, remote_object_path: str) -> str:
        """ Returns the date of a remote object. """
        raise NotImplementedError()

    def get_hash(self, local_path: str, hashlib_fn=hashlib.md5, base64encode=True) -> str:
        """
        Gets a file hash using the specified algorithm and encoding.

        Args:
            local_path (str): path to the local file.
            checksum_fn (obj): the callback used to determine
            the file's checksum.
            base64 (bool): return the hash in base64 encoding or not.
        """
        log.debug(f'Generating checksum for {local_path}...')

        hash_ = hashlib_fn()
        with open(local_path, 'rb') as fi:
            for chunk in iter(lambda: fi.read(8192), b''):
                hash_.update(chunk)
        if base64encode:
            hash_ = base64.b64encode(hash_.digest()).decode('utf-8')
        return hash_


class AzureStorageProvider(BaseCloudStorageProvider):
    # TODO: Imlpement azure provider
    def __init__(self):
        raise NotImplementedError()


class GCPStorageProvider(BaseCloudStorageProvider):

    def __init__(self):
        super().__init__(gcp_storage.Client())

    def download(self, storage_object: str, remote_object_path: str, dest_path: str):
        existing_checksum = None
        # Calculate file checksum if it exists
        if os.path.exists(dest_path):
            existing_checksum = self.get_hash(dest_path)
        else:
            base_dir = os.path.dirname(dest_path)
            # Checks to see if there's an existing directory
            if not os.path.exists(base_dir) and base_dir != '':
                os.makedirs(base_dir)

        bucket = self.client.bucket(storage_object)
        blob = bucket.blob(remote_object_path)
        # Necessary to fetch metadata of blob (i.e. checksum)
        blob.reload()
        # Only download the file if theres a difference in the checksum
        if not blob.md5_hash == existing_checksum:
            with open(dest_path, 'wb') as fi:
                blob.download_to_file(fi, checksum='md5')
                log.debug(f'Saving file "{remote_object_path}" to "{dest_path}"')

    def get_file_date(self, storage_object: str, remote_object_path: str):
        bucket = self.client.bucket(storage_object)
        blob = bucket.blob(remote_object_path)
        blob.reload()
        return blob.updated


@dataclass
class LMDBFile:
    """ Represents a LMDB file on a cloud storage """
    category: str
    version: str
    data_mdb_path: str
    lock_mdb_path: str


Base: DeclarativeMeta = declarative_base()


class LMDBsDates(Base):
    __tablename__ = 'lmdbs_dates'
    name = Column(String, primary_key=True)
    date = Column(TIMESTAMP(timezone=True), nullable=False)

    def __repr__(self):
        return f'<LMDBsDates(name={self.name}:updated={self.date})>'


class LMDBManager:
    """ LMDB manager is used to help manage the LMDB versions/lifecycle amongst other
    (1) Allows us to download from cloud to local
    (2) Allows us to update our RDBMS database with the correct upload timestamp
    (3) Allows us to change the LMDB file versions for different app versions

    Attributes:
        cloud_provider (obj): A cloud provider handler
        storage_object_name (str): represents what cloud providers call
            the top level directory (e.g. all files will reside in a particular bucket).
        config (dict): contains the list of lmdb categories and their version
            key: categories, value: version
            e.g. {'anatomy': 'v1', 'chemicals': 'v2'}
    """

    def __init__(
            self,
            cloud_provider: BaseCloudStorageProvider,
            storage_object_name: str,
            config: Optional[Dict] = None):
        self.cloud_provider = cloud_provider
        self.storage_object = storage_object_name
        self.db = self.init_db_connection()

        if config is not None:
            self.lmdb_versions = config
        else:
            base_path = os.path.dirname(os.path.realpath(__file__))
            default_config = os.path.join(base_path, 'lmdb_config.json')
            with open(default_config, 'r') as fi:
                config_fi = json.load(fi)
                self.lmdb_versions = config_fi

    def init_db_connection(self):
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

    def path_generator(self, category, version, filename) -> str:
        return f'{version}/{category}/{filename}'

    def generate_path(self, lmdb_category: str, path_fn=None) -> LMDBFile:
        """ Generates a representation of a LMDB file within a cloud storage """
        if path_fn is None:
            path_fn = self.path_generator
        version = self.lmdb_versions[lmdb_category]
        return LMDBFile(
            lmdb_category,
            version,
            path_fn(lmdb_category, version, 'data.mdb'),
            path_fn(lmdb_category, version, 'lock.mdb'))

    def generate_paths(self) -> List[LMDBFile]:
        """ Generates paths for all categories from the config """
        return [self.generate_path(category) for category in self.lmdb_versions.keys()]

    def download_all(self, save_dir):
        paths = self.generate_paths()
        for lmdb_file in paths:
            self.cloud_provider.download(
                self.storage_object,
                lmdb_file.data_mdb_path,
                f'{save_dir}/{lmdb_file.category}/data.mdb'
            )
            self.cloud_provider.download(
                self.storage_object,
                lmdb_file.lock_mdb_path,
                f'{save_dir}/{lmdb_file.category}/lock.mdb'
            )

    def download(self, remote_path, save_path):
        """ Downloads lmdb files from a remote path to a specified local path """
        self.cloud_provider.download(self.storage_object, remote_path, save_path)

    def update_all_dates(self):
        for category in self.lmdb_versions.keys():
            self.update_date(category)

    def update_date(self, lmdb_category):
        """ Updates RDBMS database to contain the file upload date from the cloud storage """
        lmdb_metadata = self.generate_path(lmdb_category)
        data_mdb_path = lmdb_metadata.data_mdb_path
        lmdb_db = self.db.query(LMDBsDates) \
                         .filter_by(name=lmdb_category) \
                         .one_or_none()
        if lmdb_db is None:
            lmdb_db = LMDBsDates(name=lmdb_category, date=datetime.utcnow())
            self.db.add(lmdb_db)
            self.db.commit()

        cloud_file_date = self.cloud_provider.get_file_date(self.storage_object, data_mdb_path)
        if lmdb_db.date != cloud_file_date:
            self.db.query(LMDBsDates) \
                   .filter_by(name=lmdb_category) \
                   .update({LMDBsDates.date: cloud_file_date})
            self.db.commit()
            log.debug(f'LMDB Database {lmdb_category} timestamp has been updated.')
        else:
            log.debug(f'LMDB Database {lmdb_category} is already up to date.')
