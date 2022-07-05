"""Sankey move views into trace networks

Revision ID: 7c3dc5068fcb
Revises: bcf11df73a79
Create Date: 2022-05-10 01:56:40.761309

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
revision = '7c3dc5068fcb'
down_revision = 'bcf11df73a79'
branch_labels = None
depends_on = None
# reference to this directory
directory = path.realpath(path.dirname(__file__))

# region Utils
with open(path.join(directory, '../upgrade_data/graph_v4.json'), 'r') as f:
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
            updated = updateCallback(data)

            if updated:
                validate_graph(data)
                raw_file = json.dumps(data).encode('utf-8')
                checksum_sha256 = hashlib.sha256(raw_file).digest()
                session.execute(
                    t_files_content.update().where(
                        t_files_content.c.id == id
                    ).values(
                        raw_file=raw_file,
                        checksum_sha256=checksum_sha256
                    )
                )
                session.flush()
    session.commit()

def update_nodes_and_links_overwrites(view, updateCallback):
    nodes = view['nodes']
    links = view['links']
    for key, node in nodes.items():
        nodes[key] = updateCallback(node)
    for key, link in links.items():
        links[key] = updateCallback(link)

# endregion

# region Upgrade
def remove_private_prefixes(obj):
    new_obj = {}
    for key, value in obj.items():
        if key.startswith('_'):
            new_obj[key[1:]] = value
        else:
            new_obj[key] = value
    return new_obj

def change_to_nested_view(view):
    view['state']['baseViewName'] = view['base']
    del view['base']
    del view['state']['networkTraceIdx']
    update_nodes_and_links_overwrites(view, remove_private_prefixes)
    return view


def move_views_to_trace_networks(data):
    views = data.get('_views')
    trace_networks = data['graph']['trace_networks']

    if views:
        for viewName, view in views.items():
            trace_network_idx = view['state']['networkTraceIdx']
            trace_network = trace_networks[trace_network_idx]
            if trace_network.get('_views') is None:
                trace_network['_views'] = {}
            existing_views = trace_network['_views']
            existing_views[viewName] = change_to_nested_view(view)
        del data['_views']
        return True
    return False


def data_upgrades():
    iterate_sankeys(move_views_to_trace_networks)


def upgrade():
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()
# endregion

# region Downgrade
def add_private_prefixes(obj):
    new_obj = {}
    for key, value in obj.items():
        if not key.startswith('_'):
            new_obj['_' + key] = value
        else:
            new_obj[key] = value
    return new_obj

def change_to_standalone_view(view, networkTraceIdx):
    view['base'] = view['state']['baseViewName']
    view['state']['networkTraceIdx'] = networkTraceIdx
    update_nodes_and_links_overwrites(view, add_private_prefixes)
    return view

def make_views_main_property(data):
    trace_networks = data.get('trace_networks', [])
    updated = False

    for networkTraceIdx, trace_network in enumerate(trace_networks):
        views = trace_network.get('_views')
        if views:
            for viewName, view in views.items():
                if data.get('_views') is None:
                    data['_views'] = {}
                views = data['_views']
                views[viewName] = change_to_standalone_view(view, networkTraceIdx)
            del trace_network['_views']
            updated = True

    return updated


def data_downgrades():
    iterate_sankeys(make_views_main_property)


def downgrade():
    """
    This downgrade does not adress case where there are multiple views with the same name.
    After downgrade only last one will persist.
    """
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_downgrades()
# endregion
