"""Update map Uniprot entities with correct links

Revision ID: a1b5886ad7cb
Revises: 6c15e2920c50
Create Date: 2023-08-21 23:53:39.867356

"""
import hashlib
import io
import json
import sqlalchemy as sa
import zipfile

from alembic import context
from alembic import op
from os import path
from sqlalchemy.orm import Session

from migrations.utils import window_chunk

FILE_MIME_TYPE_MAP = 'vnd.***ARANGO_DB_NAME***.document/map'

# revision identifiers, used by Alembic.
revision = 'a1b5886ad7cb'
down_revision = '6c15e2920c50'
branch_labels = None
depends_on = None
directory = path.realpath(path.dirname(__file__))

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
    sa.column('checksum_sha256', sa.Binary),
)


def upgrade():
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    pass


def data_upgrades():
    conn = op.get_bind()
    session = Session(conn)

    files_content = conn.execution_options(stream_results=True).execute(
        sa.select(
            [
                t_files_content.c.id,
                t_files_content.c.raw_file,
            ]
        ).select_from(
            t_files_content.join(
                t_files,
                sa.and_(
                    t_files.c.content_id == t_files_content.c.id,
                    t_files.c.mime_type == FILE_MIME_TYPE_MAP,
                ),
            )
        )
    )

    for chunk in window_chunk(files_content, 10):
        for id, raw in chunk:
            old_zip_file = zipfile.ZipFile(io.BytesIO(raw))
            map_obj = json.loads(old_zip_file.read('graph.json'))

            if 'nodes' in map_obj:
                for i, node in enumerate(map_obj['nodes']):
                    if node.get('label', None) == 'protein':
                        if 'data' in node:
                            data = node['data']

                            for property in ['search', 'references', 'hyperlinks']:
                                if property in data:
                                    updated_links = []

                                    for link in data[property]:
                                        if 'url' in link:
                                            link['url'] = link['url'].replace(
                                                'https://www.uniprot.org/uniprot/?sort=score&query=',
                                                'https://www.uniprot.org/uniprotkb?query=',
                                            )
                                        updated_links.append(link)
                                    data[property] = updated_links
                            map_obj['nodes'][i]['data'] = data

            if 'groups' in map_obj:
                for i, group in enumerate(map_obj['groups']):
                    if 'members' in group:
                        for j, node in enumerate(group['members']):
                            if node.get('label', None) == 'protein':
                                if 'data' in node:
                                    data = node['data']

                                    for property in ['search', 'references', 'hyperlinks']:
                                        if property in data:
                                            updated_links = []

                                            for link in data[property]:
                                                if 'url' in link:
                                                    link['url'] = link['url'].replace(
                                                        'https://www.uniprot.org/uniprot/?sort=score&query=',
                                                        'https://www.uniprot.org/uniprotkb?query=',
                                                    )
                                                updated_links.append(link)
                                            data[property] = updated_links
                                    map_obj['groups'][i]['members'][j]['data'] = data

            # At this point all uniprot links are fixed, we just need to zip the map and save
            byte_graph = json.dumps(map_obj, separators=(',', ':')).encode('utf-8')

            # Zip the file back up before saving to the DB
            zip_bytes = io.BytesIO()
            with zipfile.ZipFile(zip_bytes, 'x', zipfile.ZIP_DEFLATED) as new_zip_file:
                new_zip_file.writestr('graph.json', byte_graph)

                # Get all top level image nodes
                if 'nodes' in map_obj:
                    for node in map_obj['nodes']:
                        if 'image_id' in node:
                            image_name = "".join(['images/', node.get('image_id'), '.png'])
                            try:
                                image_bytes = old_zip_file.read(image_name)
                            except KeyError:
                                # For some reason there was a node with an image id, but no
                                # corresponding image file
                                continue
                            new_zip_file.writestr(image_name, image_bytes)

                # Get any image nodes nested in a group
                if 'groups' in map_obj:
                    for group in map_obj['groups']:
                        if 'members' in group:
                            for node in group['members']:
                                if 'image_id' in node:
                                    image_name = "".join(
                                        ['images/', node.get('image_id'), '.png']
                                    )
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

            session.execute(
                t_files_content.update()
                .where(t_files_content.c.id == id)
                .values(id=id, raw_file=new_bytes, checksum_sha256=new_hash)
            )
            session.flush()

        # # Flush pending updates to the transaction after every chunk
        session.commit()


def data_downgrades():
    pass
