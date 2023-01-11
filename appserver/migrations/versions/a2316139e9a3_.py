"""Redo migration 5a16c1f00f2e because the query did not account for FileVersion..
Which does not link to a current file/file content but a previous one.

Revision ID: a2316139e9a3
Revises: 5a16c1f00f2e
Create Date: 2021-10-22 01:33:29.692083

"""
import hashlib
from alembic import context
from alembic import op
import sqlalchemy as sa
from sqlalchemy import table, column, and_

import zipfile
from io import BytesIO
from sqlalchemy.orm import Session

from migrations.utils import window_chunk

# revision identifiers, used by Alembic.
revision = 'a2316139e9a3'
down_revision = '5a16c1f00f2e'
branch_labels = None
depends_on = None

FILE_MIME_TYPE_MAP = 'vnd.***ARANGO_DB_NAME***.document/map'

def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    # ### end Alembic commands ###
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    # ### end Alembic commands ###
    # NOTE: In practice perfect downgrades are difficult and in some cases
    # impossible! It is more practical to use database backups/snapshots to
    # "downgrade" the database. Changes to the database that we intend to
    # push to production should always be added to a NEW migration.
    # (i.e. "downgrade forward"!)
    pass


def data_upgrades():
    """Add optional data upgrade migrations here"""
    conn = op.get_bind()
    session = Session(conn)

    t_files = table(
        'files',
        column('id', sa.Integer),
        column('content_id', sa.Integer),
        column('mime_type', sa.String))

    t_files_version = table(
        'file_version',
        column('id', sa.Integer),
        column('content_id', sa.Integer),
        column('file_id', sa.Integer))

    t_files_content = table(
        'files_content',
        column('id', sa.Integer),
        column('raw_file', sa.LargeBinary))

    files = conn.execution_options(stream_results=True).execute(sa.select([
        t_files_content.c.id,
        t_files_content.c.raw_file
    ]).where(
        t_files_content.c.id.in_(
            sa.select([t_files_version.c.content_id]).where(
                and_(
                    t_files.c.mime_type == FILE_MIME_TYPE_MAP,
                    t_files.c.id == t_files_version.c.file_id
                )
            )
        )
    ))

    for chunk in window_chunk(files, 25):
        files_to_update = []
        for id, content in chunk:
            # because 5a16c1f00f2e already ran, we need to check if it's a zipfile
            # if not then make it one
            zip_bytes = BytesIO(content)
            try:
                with zipfile.ZipFile(zip_bytes, 'r') as zip_check:
                    zip_check.read('graph.json')
            except zipfile.BadZipFile:
                # wasn't a zip, so make it a zip
                zip_bytes2 = BytesIO()
                with zipfile.ZipFile(zip_bytes2, 'x') as zip_file:
                    zip_file.writestr('graph.json', content)
                new_bytes = zip_bytes2.getvalue()
                new_hash = hashlib.sha256(new_bytes).digest()
                files_to_update.append({'id': id, 'raw_file': new_bytes,
                                        'checksum_sha256': new_hash})
        try:
            session.bulk_update_mappings(t_files_content, files_to_update)
            session.commit()
        except Exception:
            raise


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
