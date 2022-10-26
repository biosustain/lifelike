"""add version property to graph file

Revision ID: fbfb28a836c6
Revises: a0fd1160db03
Create Date: 2022-08-10 14:30:25.373955

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
revision = 'fbfb28a836c6'
down_revision = 'a0fd1160db03'
branch_labels = None
depends_on = None
# reference to this directory
directory = path.realpath(path.dirname(__file__))

# region Utils


def validate_sankeys(validate_graph):
    conn = op.get_bind()
    session = Session(conn)

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

            validate_graph(data)

# endregion


# region Upgrade
def data_upgrades():
    with open(path.join(directory, '../upgrade_data/graph_v7.json'), 'r') as f:
        # Use this method to validate the content of an enrichment table
        validate_graph = fastjsonschema.compile(json.load(f))
        validate_sankeys(validate_graph)


def upgrade():
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()
# endregion


# region Downgrade
def data_downgrade():
    with open(path.join(directory, '../upgrade_data/graph_v6.json'), 'r') as f:
        # Use this method to validate the content of an enrichment table
        validate_graph = fastjsonschema.compile(json.load(f))
        validate_sankeys(validate_graph)


def downgrade():
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_downgrade()
# endregion
