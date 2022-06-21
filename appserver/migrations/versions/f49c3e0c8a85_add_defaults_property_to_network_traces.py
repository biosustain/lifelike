"""Add defaults property to network traces
This migration assumes that this property did not exist before and checks this assumption by
validating all sankeys against new schema.
Revision ID: f49c3e0c8a85
Revises: 7c3dc5068fcb
Create Date: 2022-06-21 14:36:49.844196
"""
import hashlib
import json
from os import path

import fastjsonschema
import sqlalchemy as sa
from alembic import context
from alembic import op
from sqlalchemy import table, column, and_
from sqlalchemy.orm import Session

from migrations.utils import window_chunk


# revision identifiers, used by Alembic.
revision = 'f49c3e0c8a85'
down_revision = '7c3dc5068fcb'
branch_labels = None
depends_on = None
# reference to this directory
directory = path.realpath(path.dirname(__file__))

# region Utils
def validate_sankeys(validator):
    conn = op.get_bind()

    t_files = table(
        'files',
        column('content_id', sa.Integer),
        column('mime_type', sa.String))

    t_files_content = table(
        'files_content',
        column('id', sa.Integer),
        column('raw_file', sa.LargeBinary),
        column('checksum_sha256', sa.Binary)
    )

    files = conn.execution_options(stream_results=True).execute(sa.select([
        t_files_content.c.id,
        t_files_content.c.raw_file
    ]).where(
        and_(
            t_files.c.mime_type == 'vnd.***ARANGO_DB_NAME***.document/graph',
            t_files.c.content_id == t_files_content.c.id
        )
    ))

    for chunk in window_chunk(files, 25):
        for id, content in chunk:
            data = json.loads(content)
            validator(data)

# endregion

# region Upgrade
def data_upgrades():
    with open(path.join(directory, '../upgrade_data/graph_v5.json'), 'r') as f:
        # Use this method to validate the content of an enrichment table
        validate_graph = fastjsonschema.compile(json.load(f))
        validate_sankeys(validate_graph)


def upgrade():
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()
# endregion

# region Downgrade
def data_downgrades():
    with open(path.join(directory, '../upgrade_data/graph_v4.json'), 'r') as f:
        # Use this method to validate the content of an enrichment table
        validate_graph = fastjsonschema.compile(json.load(f))
        validate_sankeys(validate_graph)


def downgrade():
    """
    This downgrade does not adress case where there are multiple views with the same name.
    After downgrade only last one will persist.
    """
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_downgrades()
# endregion
