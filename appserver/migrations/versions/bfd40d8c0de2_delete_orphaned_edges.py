"""Delete orphaned edges

Revision ID: bfd40d8c0de2
Revises: 6d4adebe79eb
Create Date: 2022-11-28 15:21:59.179421

"""
from os import path

from alembic import context, op
import hashlib
import io
import sqlalchemy as sa
from sqlalchemy import table, column, and_
from sqlalchemy.orm import Session
import zipfile
import json

import fastjsonschema

from migrations.utils import window_chunk

# revision identifiers, used by Alembic.
revision = 'bfd40d8c0de2'
down_revision = '6d4adebe79eb'
branch_labels = None
depends_on = None
# reference to this directory
directory = path.realpath(path.dirname(__file__))

conn = op.get_bind()

t_files = table(
    'files',
    column('id', sa.Integer),
    column('content_id', sa.Integer),
    column('mime_type', sa.String))

t_files_content = table(
    'files_content',
    column('id', sa.Integer),
    column('raw_file', sa.LargeBinary),
    column('checksum_sha256', sa.Binary)
)

with open(path.join(directory, '../upgrade_data/map_v3.json'), 'r') as f:
    # Use this method to validate the content of an enrichment table
    validate_map = fastjsonschema.compile(json.load(f))

def map_hashes(coll):
    return {node['hash'] for node in coll}


def delete_orphaned_edges(map):
    existing_hashes = map_hashes(map.get('nodes', []))
    for group in map.get('groups', []):
        existing_hashes.add(group['hash'])
        existing_hashes.update(map_hashes(group.get('members', [])))
    filtered_edges = []
    for edge in map.get('edges', []):
        if edge['from'] in existing_hashes and edge['to'] in existing_hashes:
            filtered_edges.append(edge)
    if len(filtered_edges) != len(map['edges']):
        map['edges'] = filtered_edges
        return map


def iterate_maps(migrate_callback):
    session = Session(conn)

    files = conn.execution_options(stream_results=True).execute(sa.select([
        t_files_content.c.id,
        t_files_content.c.raw_file
    ]).where(
        and_(
            t_files.c.mime_type == 'vnd.***ARANGO_DB_NAME***.document/map',
            t_files.c.content_id == t_files_content.c.id
        )
    ))

    for chunk in window_chunk(files, 25):
        for id, content in chunk:
            zip_file = zipfile.ZipFile(io.BytesIO(content))
            map_json = json.loads(zip_file.read('graph.json'))
            updated = migrate_callback(map_json)

            if updated:
                byte_graph = json.dumps(map_json, separators=(',', ':')).encode('utf-8')
                validate_map(json.loads(byte_graph))

                # Zip the file back up before saving to the DB
                zip_bytes2 = io.BytesIO()
                with zipfile.ZipFile(zip_bytes2, 'x') as zip_file:
                    zip_file.writestr('graph.json', byte_graph)
                raw_file = zip_bytes2.getvalue()
                checksum_sha256 = hashlib.sha256(raw_file).digest()
                session.execute(
                    t_files_content.update().where(
                        t_files_content.c.id == id
                    ).values(
                        raw_file=raw_file,
                        checksum_sha256=checksum_sha256
                    )
                )
                session.flush()
    session.commit()


def upgrade():
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def data_upgrades():
    """Add optional data upgrade migrations here"""
    iterate_maps(delete_orphaned_edges)
