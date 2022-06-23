"""Update all maps to v3 of schema

Revision ID: bcf11df73a79
Revises: 93b75c6f3f87
Create Date: 2022-06-22 22:54:49.855656

"""
from alembic import context, op
import hashlib
import io
import json
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import Session
import zipfile

from migrations.utils import window_chunk

from neo4japp.constants import FILE_MIME_TYPE_MAP
from neo4japp.models.files import FileContent, Files
from neo4japp.schemas.formats.drawing_tool import validate_map


# revision identifiers, used by Alembic.
revision = '9476dd461333'
down_revision = '93b75c6f3f87'
branch_labels = None
depends_on = None


def upgrade():
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    pass


def data_upgrades():
    """Add optional data upgrade migrations here"""
    conn = op.get_bind()
    session = Session(conn)

    t_files = sa.table(
        'files',
        sa.column('id', sa.Integer),
        sa.column('content_id', sa.Integer),
        sa.column('mime_type', sa.String),
    )

    t_files_content = sa.table(
        'files_content',
        sa.column('id', sa.Integer),
        sa.column('raw_file', sa.LargeBinary),
        sa.column('checksum_sha256', sa.Binary)
    )

    # This will retrieve the *content* of all enrichment tables *without* annotations. If the
    # content is invalid, we will fix it, and update the row with the valid content.
    files_content = conn.execution_options(stream_results=True).execute(
        sa.select([
            t_files_content.c.id,
            t_files_content.c.raw_file,
        ]).select_from(
            t_files_content.join(
                t_files,
                sa.and_(
                    t_files.c.content_id == t_files_content.c.id,
                    t_files.c.mime_type == FILE_MIME_TYPE_MAP,
                )
            )
        )
    )

    for chunk in window_chunk(files_content, 10):
        file_content_to_update = []
        for id, raw in chunk:
            try:
                old_zip_file = zipfile.ZipFile(io.BytesIO(raw))
                map_obj = json.loads(old_zip_file.read('graph.json'))
                validate_map(map_obj)
            except Exception:
                nodes_to_remove = []
                for i, node in enumerate(map_obj['nodes']):
                    if type(node.get('hash', None)) is not str:
                        nodes_to_remove.append(i)
                for index in nodes_to_remove:
                    map_obj['nodes'].pop(index)

                edges_to_remove = []
                for i, edge in enumerate(map_obj['edges']):
                    try:
                        if (
                            (edge['to'] is None or edge['from'] is None) or
                            (type(edge['to']) is not str or type(edge['from']) is not str)
                        ):
                            edges_to_remove.append(i)
                    except KeyError:
                        # If either 'from' or 'to' are missing then add this edge
                        edges_to_remove.append(i)
                for index in edges_to_remove:
                    map_obj['edges'].pop(index)

                # At this point, all schema issues should be resolved
                byte_graph = json.dumps(map_obj, separators=(',', ':')).encode('utf-8')
                validate_map(json.loads(byte_graph))

                # Zip the file back up before saving to the DB
                zip_bytes = io.BytesIO()
                with zipfile.ZipFile(zip_bytes, 'x', zipfile.ZIP_DEFLATED) as new_zip_file:
                    new_zip_file.writestr('graph.json', byte_graph)

                    for node in map_obj['nodes']:
                        if node.get('image_id', None) is not None:
                            image_name = "".join(['images/', node.get('image_id'), '.png'])
                            try:
                                image_bytes = old_zip_file.read(image_name)
                            except KeyError:
                                # For some reason there was a node with an image id, but no
                                # corresponding image file
                                continue
                            new_zip_file.writestr(image_name, image_bytes)

                # Create the update mapping object
                new_bytes = zip_bytes.getvalue()
                new_hash = hashlib.sha256(new_bytes).digest()
                file_content_to_update.append({'id': id, 'raw_file': new_bytes, 'checksum_sha256': new_hash})  # noqa

        # Flush pending updates to the transaction after every chunk
        session.bulk_update_mappings(FileContent, file_content_to_update)
        session.commit()


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
