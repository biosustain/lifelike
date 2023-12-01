"""Update regulon links in enrichment tables

Revision ID: 0f510c3ffec4
Revises: 109b58b5edbf
Create Date: 2023-11-02 21:59:16.148783

"""
import hashlib
import json
import sqlalchemy as sa

from alembic import context
from alembic import op
from io import BytesIO
from os import path
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Session

from migrations.utils import window_chunk


# revision identifiers, used by Alembic.
revision = '0f510c3ffec4'
down_revision = '109b58b5edbf'
branch_labels = None
depends_on = None
directory = path.realpath(path.dirname(__file__))


t_files = sa.Table(
    'files',
    sa.MetaData(),
    sa.Column('id', sa.Integer(), primary_key=True),
    sa.Column('annotations', JSONB),
    sa.Column('mime_type', sa.String()),
    sa.Column('enrichment_annotations', JSONB),
    sa.Column('content_id', sa.Integer()),
)

t_files_content = sa.Table(
    'files_content',
    sa.MetaData(),
    sa.Column('id', sa.Integer(), primary_key=True),
    sa.Column('raw_file', sa.LargeBinary()),
    sa.Column('checksum_sha256', sa.Binary()),
)

BATCH_SIZE = 1

def fix_regulon_links(enrichment: dict) -> dict:
    result = enrichment.get('result', None)
    if result is not None:
        genes = result.get('genes', None)
        if genes is not None:
            for idx, gene in enumerate(genes):
                domains = gene.get('domains', None)
                if domains is not None:
                    regulon_data = domains.get('Regulon', None)
                    if regulon_data is not None:
                        for subdomain, value in regulon_data.items():
                            link = value.get('link', None)
                            if link is not None:
                                if link.startswith('http://'):
                                    new_link = f'https://{link.split("http://")[1]}'
                                    enrichment['result']['genes'][idx]['domains']['Regulon'][subdomain]['link'] = new_link
    return enrichment



def upgrade():
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    pass


def data_upgrades():
    conn = op.get_bind()
    session = Session(conn)

    files = conn.execution_options(
        stream_results=True, max_row_buffer=BATCH_SIZE
    ).execute(
        sa.select(
            [
                t_files.c.id,
                t_files.c.annotations,
                t_files.c.enrichment_annotations,
                t_files_content.c.id,
                t_files_content.c.raw_file,
            ]
        )
        .select_from(
            t_files_content.join(
                t_files,
                sa.and_(
                    t_files.c.content_id == t_files_content.c.id,
                    t_files.c.mime_type == 'vnd.***ARANGO_DB_NAME***.document/enrichment-table'
                )
            )
        )
        .order_by(t_files.c.id)
    )

    for chunk in window_chunk(files, BATCH_SIZE):
        for file_id, annotations_obj, enrichment_annotations_obj, content_id, raw_file in chunk:
            if annotations_obj not in [[], '[]']:
                print(f'Processing File#{file_id}')
                # Update file content enrichment annotations -- these DO NOT include the annotation snippets!!
                fc_enrichment_annotations = json.load(BytesIO(raw_file))
                updated_fc_enrichment_annotations = fix_regulon_links(fc_enrichment_annotations)
                updated_raw_file = BytesIO()
                updated_raw_file.write(json.dumps(updated_fc_enrichment_annotations).encode())
                updated_raw_file = updated_raw_file.getvalue()
                new_hash = hashlib.sha256(updated_raw_file).digest()

                # Update files enrichment annotations -- these *DO* include the annotation snippets!!
                updated_file_enrichment_annotations = fix_regulon_links(enrichment_annotations_obj)

                existing_file_content = session.execute(
                    sa.select(
                        [t_files_content.c.id]
                    )
                    .where(
                        t_files_content.c.checksum_sha256 == new_hash,
                    )
                ).first()

                # If the checksum already exists in the FileContent table, don't update the old
                # row. Instead, update the File row with the existing FileContent id.
                if existing_file_content is not None:
                    print(f'\tUsing new content id for Files#{file_id}: {existing_file_content[0]}')
                    content_id = existing_file_content[0]
                else:
                    print(f'\tUpdating FilesContent#{content_id}')
                    session.execute(
                        t_files_content.update()
                        .where(t_files_content.c.id == content_id)
                        .values(
                            id=content_id,
                            raw_file=updated_raw_file,
                            checksum_sha256=new_hash,
                        )
                    )

                print(f'\tUpdating Files#{file_id}')
                session.execute(
                    t_files.update()
                    .where(t_files.c.id == file_id)
                    .values(
                        content_id=content_id,
                        enrichment_annotations=updated_file_enrichment_annotations,
                    )
                )
                session.flush()
        session.commit()


def data_downgrades():
    pass
