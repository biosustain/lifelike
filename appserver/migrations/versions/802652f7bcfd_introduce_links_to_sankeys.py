"""introduce links to sankeys

Revision ID: 802652f7bcfd
Revises: 7c3dc5068fcb
Create Date: 2022-06-09 22:45:05.954105

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
revision = '802652f7bcfd'
down_revision = '7c3dc5068fcb'
branch_labels = None
depends_on = None
# reference to this directory
directory = path.realpath(path.dirname(__file__))

# region Utils
with open(path.join(directory, '../upgrade_data/graph_v5.json'), 'r') as f:
    # Use this method to validate the content of an enrichment table
    validate_graph = fastjsonschema.compile(json.load(f))

def iterate_sankeys(updateCallback):
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
            updateCallback(data)

            validate_graph(data)

# endregion

# region Upgrade
def check_if_link_exist(entity):
    if entity.get('displayProperties'):
        raise Exception("Property already exist")

def crash_if_new_property_already_exist(data):
    trace_networks = data['graph']['trace_networks']
    for trace_network in trace_networks:
        for trace in trace_network['traces']:
            check_if_link_exist(trace)
    for node in data['nodes']:
        check_if_link_exist(node)
    for link in data['links']:
        check_if_link_exist(link)

def data_upgrades():
    iterate_sankeys(crash_if_new_property_already_exist)

def upgrade():
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()
# endregion

# region Downgrade
def downgrade():
    pass
# endregion
