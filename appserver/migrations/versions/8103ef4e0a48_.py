"""Fix compression of map zip files

Revision ID: 8103ef4e0a48
Revises: 7102b4744622
Create Date: 2022-05-04 19:47:18.237345

"""
from alembic import context, op
import hashlib
from io import BytesIO
import json
import sqlalchemy as sa
from sqlalchemy.orm import Session
import zipfile

from migrations.utils import window_chunk
from neo4japp.models import FileContent
from neo4japp.constants import FILE_MIME_TYPE_MAP


# revision identifiers, used by Alembic.
revision = '8103ef4e0a48'
down_revision = '7102b4744622'
branch_labels = None
depends_on = None


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

    t_files = sa.table(
        'files',
        sa.column('id', sa.Integer),
        sa.column('content_id', sa.Integer),
        sa.column('mime_type', sa.String))

    t_files_version = sa.table(
        'file_version',
        sa.column('id', sa.Integer),
        sa.column('content_id', sa.Integer),
        sa.column('file_id', sa.Integer))

    t_files_content = sa.table(
        'files_content',
        sa.column('id', sa.Integer),
        sa.column('raw_file', sa.LargeBinary))

    files = conn.execution_options(stream_results=True).execute(sa.select([
        t_files_content.c.id,
        t_files_content.c.raw_file
    ]).where(
        t_files_content.c.id.in_(
            sa.union(
                sa.select([t_files_version.c.content_id]),
                sa.select([t_files.c.content_id]).where(t_files.c.mime_type == FILE_MIME_TYPE_MAP)
            )
        )
    ))

    for chunk in window_chunk(files, 25):
        files_to_update = []
        for id, content in chunk:
            # Read the data from the original, uncompressed zip file
            uncompressed_zip_file = zipfile.ZipFile(BytesIO(content))
            map_json = json.loads(uncompressed_zip_file.read('graph.json'))
            byte_graph = json.dumps(map_json, separators=(',', ':')).encode('utf-8')

            # Create a new, properly compressed zip file
            zip_bytes = BytesIO()
            with zipfile.ZipFile(zip_bytes, 'x', zipfile.ZIP_DEFLATED) as compressed_zip_file:
                compressed_zip_file.writestr('graph.json', byte_graph)

                for node in map_json['nodes']:
                    if node.get('image_id', None) is not None:
                        image_name = "".join(['images/', node.get('image_id'), '.png'])
                        try:
                            image_bytes = uncompressed_zip_file.read(image_name)
                        except KeyError:
                            # For some reason there was a node with an image id, but no
                            # corresponding image file
                            continue
                        compressed_zip_file.writestr(image_name, image_bytes)

            # Create the file_content update mapping object, and add it to the list of updates
            new_bytes = zip_bytes.getvalue()
            new_hash = hashlib.sha256(new_bytes).digest()
            files_to_update.append({'id': id, 'raw_file': new_bytes,
                                    'checksum_sha256': new_hash})
        try:
            session.bulk_update_mappings(FileContent, files_to_update)
            session.commit()
        except Exception:
            raise


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
