"""Add sample project

Revision ID: ad97ec0e4973
Revises: 3d1cdf7b9d1b
Create Date: 2023-02-09 20:59:14.824234

"""
from alembic import context, op
from datetime import datetime, timezone
import enum
from flask_sqlalchemy import SQLAlchemy
import hashlib
import json
from pathlib import Path
import re
from sqlalchemy import (
    func,
    select,
    BINARY,
    Boolean,
    Column,
    Enum,
    Integer,
    LargeBinary,
    MetaData,
    String,
    Table,
    Text
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.engine import Connection
from sqlalchemy.types import TIMESTAMP
import uuid

from neo4japp.services.file_types.providers import MapTypeProvider


# revision identifiers, used by Alembic.
revision = 'ad97ec0e4973'
down_revision = '3d1cdf7b9d1b'
branch_labels = None
depends_on = None

db = SQLAlchemy()

INITIAL_PROJECT_FILES_PATH = Path('migrations/upgrade_data/initial_project')
ET_ANNOTATIONS_FILENAME = 'et_annotations.json'
PDF_ANNOTATIONS_FILENAME = 'pdf_annotations.json'
FILE_MIME_TYPE_DIRECTORY = 'vnd.***ARANGO_DB_NAME***.filesystem/directory'
FILE_MIME_TYPE_PDF = 'application/pdf'
FILE_MIME_TYPE_MAP = 'vnd.***ARANGO_DB_NAME***.document/map'
FILE_MIME_TYPE_ENRICHMENT_TABLE = 'vnd.***ARANGO_DB_NAME***.document/enrichment-table'
MASTER_PROJECT_NAME = 'master-initial-project'
MASTER_PROJECT_FOLDER_PATH = f'/{MASTER_PROJECT_NAME}'
TIMEZONE = timezone.utc


# copied from /models/files.py
class AnnotationChangeCause(enum.Enum):
    USER = 'user'
    USER_REANNOTATION = 'user_reannotation'
    SYSTEM_REANNOTATION = 'sys_reannotation'


t_files = Table(
    'files',
    MetaData(),
    Column('id', Integer, primary_key=True),
    Column('hash_id', String),
    Column('filename', String),
    Column('parent_id', Integer),
    Column('mime_type', String),
    Column('content_id', Integer),
    Column('user_id', Integer),
    Column('public', Boolean, default=False),
    Column('pinned', Boolean, default=False),
    Column('description', String),
    Column('creation_date', TIMESTAMP(timezone=True), default=func.now()),
    Column('modified_date', TIMESTAMP(timezone=True), default=func.now()),
    Column('path', Text),
    Column('annotations', JSONB),
    Column('annotations_date', TIMESTAMP(timezone=True), default=func.now()),
    Column('enrichment_annotations', JSONB),
    Column('annotation_configs', JSONB),
    Column('organism_name', String),
    Column('organism_synonym', String),
    Column('organism_taxonomy_id', String),
)

t_file_annotations_version = Table(
    'file_annotations_version',
    MetaData(),
    Column('id', Integer, primary_key=True),
    Column('hash_id', String),
    Column('file_id', Integer),
    Column('cause', Enum(AnnotationChangeCause)),
    Column('custom_annotations', JSONB, default='[]'),
    Column('excluded_annotations', JSONB, default='[]'),
    Column('user_id', Integer),
    Column('creation_date', TIMESTAMP(timezone=True), default=func.now()),
    Column('modified_date', TIMESTAMP(timezone=True), default=func.now()),
)

t_files_content = Table(
    'files_content',
    MetaData(),
    Column('id', Integer, primary_key=True),
    Column('raw_file', LargeBinary),
    Column('checksum_sha256', BINARY(32)),
    Column('creation_date', TIMESTAMP(timezone=True), default=func.now()),
)

t_projects = Table(
    'projects',
    MetaData(),
    Column('id', Integer, primary_key=True),
    Column('hash_id', String),
    Column('name', String),
    Column('description', Text),
    Column('***ARANGO_USERNAME***_id', Integer),
    Column('creation_date', TIMESTAMP(timezone=True), default=func.now()),
    Column('modified_date', TIMESTAMP(timezone=True), default=func.now()),
)

t_projects_collaborator_role = Table(
    'projects_collaborator_role',
    MetaData(),
    Column('appuser_id', Integer),
    Column('app_role_id', Integer),
    Column('projects_id', Integer)
)

t_app_role = Table(
    'app_role',
    MetaData(),
    Column('id', Integer, primary_key=True),
    Column('name', String)
)

t_appuser = Table(
    'appuser',
    MetaData(),
    Column('id', Integer, primary_key=True),
    Column('hash_id', String),
    Column('username', String),
    Column('email', String),
    Column('first_name', String),
    Column('last_name', String),
    Column('password_hash', String),
    Column('failed_login_count', Integer, default=0),
    Column('forced_password_reset', Boolean),
    Column('subject', String),
    Column('creation_date', TIMESTAMP(timezone=True), default=func.now()),
    Column('modified_date', TIMESTAMP(timezone=True), default=func.now()),
)

t_appuser_role = Table(
    'app_user_role',
    MetaData(),
    Column('appuser_id', Integer),
    Column('app_role_id', Integer)
)


def upgrade():
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    pass
    # NOTE: In practice perfect downgrades are difficult and in some cases
    # impossible! It is more practical to use database backups/snapshots to
    # "downgrade" the database. Changes to the database that we intend to
    # push to production should always be added to a NEW migration.
    # (i.e. "downgrade forward"!)


def _create_file_content(conxn: Connection, master_file_path: str):
    with open(master_file_path, 'rb') as fp:
        content = fp.read()

    checksum_sha256 = hashlib.sha256(content).digest()

    # Check if the file already exists in the DB (this is probably true!)
    file_content_id = conxn.execute(select([
        t_files_content.c.id,
    ]).where(
        t_files_content.c.checksum_sha256 == checksum_sha256
    )).scalar()

    if file_content_id is None:
        file_content_id = conxn.execute(
            t_files_content.insert().values(
                raw_file=content,
                checksum_sha256=checksum_sha256,
            )
        ).inserted_primary_key[0]
    return file_content_id


def _create_master_pdf(
    conxn: Connection,
    pdf_metadata: dict,
    superuser_id: int,
    master_folder_id: int
) -> str:
    pdf_filename = pdf_metadata['filename']
    pdf_file_content_id = _create_file_content(conxn, INITIAL_PROJECT_FILES_PATH / pdf_filename)
    pdf_hash_id = str(uuid.uuid4())

    with open(INITIAL_PROJECT_FILES_PATH / PDF_ANNOTATIONS_FILENAME) as pdf_anno_fp:
        pdf_annotations = json.load(pdf_anno_fp)['annotations']

    new_pdf_file = conxn.execute(
        t_files.insert().values(
            hash_id=pdf_hash_id,
            filename=pdf_filename,
            parent_id=master_folder_id,
            mime_type=FILE_MIME_TYPE_PDF,
            content_id=pdf_file_content_id,
            user_id=superuser_id,
            public=False,
            pinned=False,
            path=f'{MASTER_PROJECT_FOLDER_PATH}/{pdf_filename}',
            annotations=pdf_annotations,
            annotations_date=datetime.now(TIMEZONE),
            organism_name=pdf_metadata['organism_name'],
            organism_synonym=pdf_metadata['organism_synonym'],
            organism_taxonomy_id=pdf_metadata['organism_taxonomy_id'],
        )
    ).inserted_primary_key[0]

    # Also make sure to add the FileAnnotationsVersion row
    conxn.execute(
        t_file_annotations_version.insert().values(
            file_id=new_pdf_file,
            hash_id=str(uuid.uuid4()),
            cause=AnnotationChangeCause.SYSTEM_REANNOTATION,
            custom_annotations=[],
            excluded_annotations=[],
            user_id=superuser_id
        )
    )

    return pdf_hash_id


def _create_master_enrichment_table(
    conxn: Connection,
    et_metadata: dict,
    superuser_id: int,
    master_folder_id: int
):
    et_filename = et_metadata['filename']
    et_file_content_id = _create_file_content(conxn, INITIAL_PROJECT_FILES_PATH / et_filename)

    with open(INITIAL_PROJECT_FILES_PATH / ET_ANNOTATIONS_FILENAME) as et_anno_fp:
        et_annotations = json.load(et_anno_fp)
        annotations = et_annotations['annotations']
        enrichment_annotations = et_annotations['enrichment_annotations']

    new_et_file = conxn.execute(
        t_files.insert().values(
            hash_id=str(uuid.uuid4()),
            filename=et_filename,
            parent_id=master_folder_id,
            mime_type=FILE_MIME_TYPE_ENRICHMENT_TABLE,
            content_id=et_file_content_id,
            user_id=superuser_id,
            public=False,
            pinned=False,
            path=f'{MASTER_PROJECT_FOLDER_PATH}/{et_filename}',
            description=et_metadata['description'],
            annotations=annotations,
            enrichment_annotations=enrichment_annotations,
            annotations_date=datetime.now(TIMEZONE),
            annotation_configs=et_metadata['annotation_configs'],
            organism_name=et_metadata['organism_name'],
            organism_synonym=et_metadata['organism_synonym'],
            organism_taxonomy_id=et_metadata['organism_taxonomy_id'],
        )
    ).inserted_primary_key[0]


    # Also make sure to add the FileAnnotationsVersion row
    conxn.execute(
        t_file_annotations_version.insert().values(
            file_id=new_et_file,
            hash_id=str(uuid.uuid4()),
            cause=AnnotationChangeCause.SYSTEM_REANNOTATION,
            custom_annotations=[],
            excluded_annotations=[],
            user_id=superuser_id
        )
    )


def _create_master_map(
    conxn: Connection,
    map_metadata: dict,
    superuser_id: int,
    master_folder_id: int,
    master_pdf_hash_id: str
):
    def update_map_links(map_json):
        new_link_re = r'^\/projects\/([^\/]+)\/[^\/]+\/([a-zA-Z0-9-]+)'
        for node in map_json['nodes']:
            for source in node['data'].get('sources', []):
                link_search = re.search(new_link_re, source['url'])
                if link_search is not None:
                    project_name = link_search.group(1)
                    hash_id = link_search.group(2)
                    if hash_id in map_metadata['hash_mapping']:
                        source['url'] = source['url'].replace(
                            project_name,
                            MASTER_PROJECT_NAME
                        ).replace(
                            hash_id,
                            master_pdf_hash_id
                        )
        for edge in map_json['edges']:
            if 'data' in edge:
                for source in edge['data'].get('sources', []):
                    link_search = re.search(new_link_re, source['url'])
                    if link_search is not None:
                        project_name = link_search.group(1)
                        hash_id = link_search.group(2)
                    if hash_id in map_metadata['hash_mapping']:
                            source['url'] = source['url'].replace(
                                project_name,
                                MASTER_PROJECT_NAME
                            ).replace(
                                hash_id,
                                master_pdf_hash_id
                            )
        return map_json

    map_filename = map_metadata['filename']
    updated_map_content = MapTypeProvider().update_map(
        {},
        INITIAL_PROJECT_FILES_PATH / map_filename,
        update_map_links
    )
    buffer = updated_map_content.read()
    checksum_sha256 = hashlib.sha256(buffer).digest()

    # Check if the file already exists in the DB (this is probably true!)
    file_content_id = conxn.execute(select([
        t_files_content.c.id,
    ]).where(
        t_files_content.c.checksum_sha256 == checksum_sha256
    )).scalar()

    if file_content_id is None:
        file_content_id = conxn.execute(
            t_files_content.insert().values(
                raw_file=buffer,
                checksum_sha256=checksum_sha256,
            )
        ).inserted_primary_key[0]

    conxn.execute(
        t_files.insert().values(
            hash_id=str(uuid.uuid4()),
            filename=map_filename,
            parent_id=master_folder_id,
            mime_type=FILE_MIME_TYPE_MAP,
            content_id=file_content_id,
            user_id=superuser_id,
            public=False,
            pinned=False,
            path=f'{MASTER_PROJECT_FOLDER_PATH}/{map_filename}',
        )
    )

def _create_files(conxn: Connection, superuser_id: int, master_folder_id: int):
    with open(INITIAL_PROJECT_FILES_PATH / 'metadata.json', 'r') as metadata_json:
        metadata = json.load(metadata_json)

    master_pdf_hash_id = _create_master_pdf(conxn, metadata['files']['pdf'], superuser_id, master_folder_id)
    _create_master_enrichment_table(
        conxn,
        metadata['files']['enrichment_table'],
        superuser_id,
        master_folder_id
    )
    _create_master_map(
        conxn,
        metadata['files']['map'],
        superuser_id,
        master_folder_id,
        master_pdf_hash_id
    )


def _get_superuser_id(conxn: Connection):
    # Get superuser id
    return conxn.execute(select([
        t_appuser.c.id,
    ]).where(
        t_appuser.c.email == 'superuser@***ARANGO_DB_NAME***.bio'
    )).scalar()


def _create_***ARANGO_USERNAME***_file_for_master_project(conxn: Connection, superuser_id: int) -> int:
    # Create ***ARANGO_USERNAME*** file
    return conxn.execute(
        t_files.insert().values(
            hash_id=str(uuid.uuid4()),
            filename='/',
            mime_type=FILE_MIME_TYPE_DIRECTORY,
            user_id=superuser_id,
            path=MASTER_PROJECT_FOLDER_PATH,
        )
    ).inserted_primary_key[0]


def _create_master_project(conxn: Connection, master_folder_id: int) -> int:
    return conxn.execute(
        t_projects.insert().values(
            hash_id=str(uuid.uuid4()),
            name=MASTER_PROJECT_NAME,
            description='Master copy of the initial user project.',
            ***ARANGO_USERNAME***_id=master_folder_id,
        )
    ).inserted_primary_key[0]


def _add_all_admins_to_master_project(conxn: Connection, master_project_id: int):
    admin_role_id = conxn.execute(
        select([
            t_app_role.c.id,
        ]).where(
            t_app_role.c.name == 'admin'
        )
    ).scalar()

    admin_ids = conxn.execute(select([
        t_appuser_role.c.appuser_id,
    ]).where(
        t_appuser_role.c.app_role_id == admin_role_id
    )).fetchall()

    # Add each admin as a 'project-admin' for the master project

    project_admin_role_id = conxn.execute(
        select([
            t_app_role.c.id,
        ]).where(
            t_app_role.c.name == 'project-admin'
        )
    ).scalar()

    for admin, in admin_ids:
        conxn.execute(
            t_projects_collaborator_role.insert().values(
                appuser_id=admin,
                app_role_id=project_admin_role_id,
                projects_id=master_project_id,
            )
        )


def data_upgrades():
    """Add optional data upgrade migrations here"""
    conxn = op.get_bind()

    superuser_id = _get_superuser_id(conxn)
    master_initial_folder_id = _create_***ARANGO_USERNAME***_file_for_master_project(conxn, superuser_id)
    master_initial_project_id = _create_master_project(conxn, master_initial_folder_id)
    _add_all_admins_to_master_project(conxn, master_initial_project_id)
    _create_files(conxn, superuser_id, master_initial_folder_id)


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
