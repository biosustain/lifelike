"""Update protein annotations with correct Uniprot links

Revision ID: 6c15e2920c50
Revises: e1b35c398626
Create Date: 2023-08-21 22:44:05.596218

"""
import json
import sqlalchemy as sa

from alembic import context
from alembic import op
from os import path
from sqlalchemy import table, column, or_, Integer, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql.expression import func
from sqlalchemy.orm import Session

from migrations.utils import window_chunk


# revision identifiers, used by Alembic.
revision = '6c15e2920c50'
down_revision = 'e1b35c398626'
branch_labels = None
depends_on = None
directory = path.realpath(path.dirname(__file__))


t_files = table(
    'files',
    column('id', Integer),
    column('annotations', JSONB),
)


def upgrade():
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    pass


def fix_annotation_protein_links(annotation):
    meta = annotation['meta']
    if meta['type'] == 'Protein':
        meta['links'][
            'uniprot'
        ] = f'https://www.uniprot.org/uniprotkb?query={meta["allText"]}'

        for i, link in enumerate(meta['idHyperlinks']):
            meta['idHyperlinks'][i] = link.replace(
                'https://www.uniprot.org/uniprot/?sort=score&query=',
                'https://www.uniprot.org/uniprotkb?query=',
            )

        return {**annotation, "meta": {**meta}}


def process_result_value(value):
    return list(map(fix_annotation_protein_links, value))


def update_annotation_list(annotations):
    updated_annotations = process_result_value(annotations)
    if any(updated_annotations):
        return list(
            map(
                lambda zipped: zipped[1] or zipped[0],
                zip(annotations, updated_annotations),
            )
        )


def update_annotations(annotations):
    updated_annotations = update_annotation_list(annotations)
    if updated_annotations:
        return updated_annotations


def data_upgrades():
    conn = op.get_bind()
    session = Session(conn)

    files = conn.execution_options(stream_results=True).execute(
        sa.select([t_files.c.id, t_files.c.annotations])
    )

    for chunk in window_chunk(files, 25):
        for file_id, annotations_obj in chunk:
            if annotations_obj != []:
                # Unfortunately some of our annotations are single element list objects. For the
                # migration not to fail we need to catch these and convert to the correct format.
                if type(annotations_obj) == list:
                    annotations_obj = annotations_obj[0]

                annotations_list = annotations_obj['documents'][0]['passages'][0][
                    'annotations'
                ]

                updated_annotations_list = update_annotations(annotations_list)
                if updated_annotations_list is not None:
                    annotations_obj['documents'][0]['passages'][0][
                        'annotations'
                    ] = updated_annotations_list
                    session.execute(
                        t_files.update()
                        .where(t_files.c.id == file_id)
                        .values(annotations=annotations_obj)
                    )
                    session.flush()
    session.commit()


def data_downgrades():
    pass
