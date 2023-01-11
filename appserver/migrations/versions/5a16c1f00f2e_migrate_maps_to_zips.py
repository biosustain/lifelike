"""Migrate maps to zips

Revision ID: 5a16c1f00f2e
Revises: d75017512d42
Create Date: 2021-09-24 13:08:48.083246

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
revision = '5a16c1f00f2e'
down_revision = 'd75017512d42'
branch_labels = None
depends_on = None

FILE_MIME_TYPE_MAP = 'vnd.***ARANGO_DB_NAME***.document/map'

def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    # ### end Alembic commands ###
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    pass
    # ### commands auto generated by Alembic - please adjust! ###
    # ### end Alembic commands ###
    # NOTE: In practice perfect downgrades are difficult and in some cases
    # impossible! It is more practical to use database backups/snapshots to
    # "downgrade" the database. Changes to the database that we intend to
    # push to production should always be added to a NEW migration.
    # (i.e. "downgrade forward"!)


def data_upgrades():
    """
    Due to the addition of the images to the map files, we now store them as a zip files.
    """
    conn = op.get_bind()
    session = Session(conn)

    t_files = table(
        'files',
        column('id', sa.Integer),
        column('content_id', sa.Integer),
        column('mime_type', sa.String))

    t_files_content = table(
        'files_content',
        column('id', sa.Integer),
        column('raw_file', sa.LargeBinary))

    files = conn.execution_options(stream_results=True).execute(sa.select([
        t_files_content.c.id,
        t_files_content.c.raw_file
    ]).where(
        and_(
            t_files.c.mime_type == FILE_MIME_TYPE_MAP,
            t_files.c.content_id == t_files_content.c.id
        )
    ))

    for chunk in window_chunk(files, 25):
        files_to_update = []
        for id, content in chunk:
            zip_bytes = BytesIO()
            with zipfile.ZipFile(zip_bytes, 'x') as zip_file:
                zip_file.writestr('graph.json', content)
            new_bytes = zip_bytes.getvalue()
            new_hash = hashlib.sha256(new_bytes).digest()
            files_to_update.append({'id': id, 'raw_file': new_bytes,
                                    'checksum_sha256': new_hash})
        try:
            session.bulk_update_mappings(t_files_content, files_to_update)
            session.commit()
        except Exception:
            pass


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
