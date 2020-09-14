"""Fix/Upgrade project data

Revision ID: 1c3ac93bf8e7
Revises: 290f9d53c7f2
Create Date: 2020-09-14 16:11:19.709898

"""
import copy
import json
from alembic import context
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy_utils.types import TSVectorType


# revision identifiers, used by Alembic.
revision = '1c3ac93bf8e7'
down_revision = '290f9d53c7f2'
branch_labels = None
depends_on = None

t_app_user = sa.Table(
    'appuser',
    sa.MetaData(),
    sa.Column('id', sa.Integer, primary_key=True),
    sa.Column('username', sa.String(64), index=True, unique=True),
    sa.Column('email', sa.String(120), index=True, unique=True),
    sa.Column('first_name', sa.String(120), nullable=False),
    sa.Column('last_name', sa.String(120), nullable=False),
)

t_files_content = sa.Table(
    'files_content',
    sa.MetaData(),
    sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
    sa.Column('raw_file', sa.LargeBinary, nullable=True),
    sa.Column('checksum_sha256', sa.Binary(32), nullable=False, index=True, unique=True),
    sa.Column('creation_date', sa.DateTime, nullable=False, default=sa.func.now()),
)

t_directory = sa.Table(
    'directory',
    sa.MetaData(),
    sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
    sa.Column('name', sa.String(200), nullable=False),
    sa.Column('directory_parent_id', sa.Integer, sa.ForeignKey('directory.id'), nullable=True),
    sa.Column('projects_id', sa.Integer, sa.ForeignKey('projects.id'), nullable=False),
    sa.Column('user_id', sa.Integer, sa.ForeignKey('appuser.id'), nullable=False)
)

t_files = sa.Table(
    'files',
    sa.MetaData(),
    sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
    sa.Column('file_id', sa.String(36), unique=True, nullable=False),
    sa.Column('filename', sa.String(60)),
    sa.Column('description', sa.String(2048), nullable=True),
    sa.Column('content_id', sa.Integer, sa.ForeignKey(
        'files_content.id', ondelete='CASCADE'), nullable=False),
    sa.Column('user_id', sa.Integer, sa.ForeignKey('appuser.id'), nullable=False),
    sa.Column('creation_date', sa.DATETIME),
    sa.Column('annotations', postgresql.JSONB, nullable=False),
    sa.Column('annotations_date', sa.TIMESTAMP, nullable=True),
    sa.Column('project', sa.Integer, sa.ForeignKey('projects.id'), nullable=False),
    sa.Column('custom_annotations', postgresql.JSONB, nullable=False),
    sa.Column('dir_id', sa.Integer, sa.ForeignKey('directory.id'), nullable=False),
    sa.Column('doi', sa.String(1024), nullable=True),
    sa.Column('upload_url', sa.String(2048), nullable=True),
    sa.Column('excluded_annotations', postgresql.JSONB, nullable=False),
)

t_project = sa.Table(
    'project',
    sa.MetaData(),
    sa.Column('id', sa.Integer, primary_key=True),
    sa.Column('label', sa.String(250), nullable=False),
    sa.Column('description', sa.Text),
    sa.Column('modified_date', sa.DateTime),
    sa.Column('graph', sa.JSON),
    sa.Column('author', sa.String(240), nullable=False),
    sa.Column('public', sa.Boolean(), default=False),
    sa.Column('user_id', sa.Integer, sa.ForeignKey(t_app_user.c.id)),
    sa.Column('dir_id', sa.Integer, sa.ForeignKey(t_directory.c.id)),
    sa.Column('hash_id', sa.String(50), unique=True),
    sa.Column('search_vector', TSVectorType('label'))
)

t_projects = sa.Table(
    'projects',
    sa.MetaData(),
    sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
    sa.Column('project_name', sa.String(250), unique=True, nullable=False),
    sa.Column('description', sa.Text),
    sa.Column('creation_date', sa.DateTime, nullable=False, default=sa.func.now()),
    sa.Column('users', sa.ARRAY(sa.Integer), nullable=False)
)

""" Node JSON schema
{
    'data': {
        'x': 47,
        'y': -605,
        'hyperlink': '',
        'detail': '',
        'source': '',
        'search': [],
        'subtype': '',
        'hyperlinks': [],
        'sources': [{'type': str, 'domain': str, 'url': str}]
    },
    'display_name': 'E. coli',
    'hash': '84c5a886-8727-44fb-935e-5e9e01a039bb',
    'shape': 'box',
    'label': 'species',
    'sub_labels': []
}
"""


def upgrade():
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    pass
    # NOTE: In practice perfect downgrades are difficult and in some cases
    # impossible! It is more practical to use database backups/snapshots to
    # "downgrade" the database. Changes to the database that we intend to
    # push to production should always be added to a NEW migration.
    # (i.e. "downgrade forward"!)


def get_src_type(source):
    return source.split('/')[2]


def get_src_hash_id(source):
    return source.split('/')[3]


def get_projects_name(dir_id):
    """ Return the `Projects name` to which
    the asset is located under """
    conn = op.get_bind()
    return conn.execute(
        sa.select(
            [t_projects.c.project_name]
        ).select_from(sa.join(
            t_projects,
            t_directory,
            t_projects.c.id == dir_id
        ))
    ).fetchone()[0]


def convert_map_source(node, projects_name):
    """ Perform conversions if a map source is found """
    node_copy = copy.deepcopy(node)
    data = node_copy['data']
    source = data.get('source')
    sources = data.get('sources')

    if source and get_src_type(source) == 'map':
        data['source'] = map_source_conversion(source, projects_name)
    if sources:
        data['sources'] = [
            map_source_conversion(s['url'], projects_name, True)
            for s in sources if get_src_type(s['url']) == 'map']

    return node_copy


def map_source_conversion(source, projects_name, new_structure=False):
    hash_id = get_src_hash_id(source)
    link = f'/projects/{projects_name}/maps/{hash_id}/edit'
    if new_structure:
        return {'type': '', 'domain': 'File Source', 'url': link}
    return link


def data_upgrades():
    """Add optional data upgrade migrations here"""
    conn = op.get_bind()
    project = conn.execute(sa.select([t_project])).fetchall()
    for proj_id, _, _, _, graph, _, _, user_id, dir_id, _, _ in project:
        nodes = graph['nodes']
        edges = graph['edges']
        projects_name = get_projects_name(dir_id)
        nodes = [convert_map_source(node, projects_name) for node in nodes]
        edges = [convert_map_source(edge, projects_name) for edge in edges]
        graph['nodes'] = nodes
        graph['edges'] = edges
        conn.execute(t_project.update().where(t_project.c.id == proj_id).values(graph=graph))


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
