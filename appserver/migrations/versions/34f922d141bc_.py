""" Move all of the users maps & files from beta-project
    to their own personal project

Revision ID: 34f922d141bc
Revises: 36d25e171658
Create Date: 2020-07-24 21:19:46.808252

"""
from alembic import context
from alembic import op
import enum
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy_utils.types import TSVectorType

from neo4japp.models import (
    AppRole,
    Projects,
    projects_collaborator_role,
)
from neo4japp.models.common import RDBMSBase


# Moved this here from the auth models file. We removed this class as part of 6b7a2da00472 because
# it was unused.
class AccessRuleType(enum.Enum):
    """ Allow or Deny """
    ALLOW = 'allow'
    DENY = 'deny'


# Moved this here from the auth models file. We removed this class as part of 6b7a2da00472 because
# it was unused.
class AccessActionType(enum.Enum):
    READ = 'read'
    WRITE = 'write'


# Moved this here from the auth models file. We dropped this table in 6b7a2da00472 because it was
# unused.
class AccessControlPolicy(RDBMSBase):
    """ Which user, group, etc have what access to protected resources """
    id = sa.Column(sa.Integer, primary_key=True)
    action = sa.Column(sa.Enum(AccessActionType), nullable=False)
    asset_type = sa.Column(sa.String(200), nullable=False)
    asset_id = sa.Column(sa.Integer, nullable=True)
    principal_type = sa.Column(sa.String(50), nullable=False)
    principal_id = sa.Column(sa.Integer, nullable=True)
    rule_type = sa.Column(sa.Enum(AccessRuleType), nullable=False)

    __table_args__ = (
        sa.Index(
            'ix_acp_asset_key',
            'asset_type',
            'asset_id',
        ),
        sa.Index(
            'ix_acp_principal_key',
            'principal_type',
            'principal_id',
        ),
    )


# revision identifiers, used by Alembic.
revision = '34f922d141bc'
down_revision = '36d25e171658'
branch_labels = None
depends_on = None

t_files_content = sa.Table(
    'files_content',
    sa.MetaData(),
    sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
    sa.Column('raw_file', sa.LargeBinary, nullable=True),
    sa.Column('checksum_sha256', sa.Binary(32), nullable=False, index=True, unique=True),
    sa.Column('creation_date', sa.DateTime, nullable=False, default=sa.func.now()),
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

t_directory = sa.Table(
    'directory',
    sa.MetaData(),
    sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
    sa.Column('name', sa.String(200), nullable=False),
    sa.Column('directory_parent_id', sa.Integer, sa.ForeignKey('directory.id'), nullable=True),
    sa.Column('projects_id', sa.Integer, sa.ForeignKey('projects.id'), nullable=False),
    sa.Column('user_id', sa.Integer, sa.ForeignKey('appuser.id'), nullable=False)
)

t_app_user = sa.Table(
    'appuser',
    sa.MetaData(),
    sa.Column('id', sa.Integer, primary_key=True),
    sa.Column('username', sa.String(64), index=True, unique=True),
    sa.Column('email', sa.String(120), index=True, unique=True),
    sa.Column('first_name', sa.String(120), nullable=False),
    sa.Column('last_name', sa.String(120), nullable=False),
)

t_app_role = sa.Table(
    'app_role',
    sa.MetaData(),
    sa.Column('id', sa.Integer, primary_key=True),
    sa.Column('name', sa.String(128), nullable=False, unique=True),
)

t_project = sa.Table(
    'project',
    sa.MetaData(),
    sa.Column('id', sa.Integer, primary_key=True),
    sa.Column('label', sa.String(250), nullable=False),
    sa.Column('description', sa.Text),
    sa.Column('date_modified', sa.DateTime),
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


def data_upgrades():
    """Add optional data upgrade migrations here"""

    conn = op.get_bind()

    users = conn.execute(sa.select([
        t_app_user.c.id,
        t_app_user.c.username
    ])).fetchall()

    for (user_id, username) in users:

        # Create personal project for that user
        projects_id = conn.execute(
            t_projects.insert().values(
                project_name="{}-Personal-Project".format(username),
                description="Personal Project folder",
                users=[user_id],
            )
        ).inserted_primary_key[0]

        directory_id = conn.execute(
            t_directory.insert().values(
                name='/',
                directory_parent_id=None,
                projects_id=projects_id,
                user_id=user_id
            )
        ).inserted_primary_key[0]

        # Get admin role
        (admin_role_id,) = conn.execute(sa.select([
            t_app_role.c.id
        ]).where(t_app_role.c.name == 'project-admin')).fetchone()

        conn.execute(AccessControlPolicy.__table__.insert().values(
            action=AccessActionType.READ,
            asset_type=Projects.__tablename__,
            asset_id=projects_id,
            principal_type=AppRole.__tablename__,
            principal_id=admin_role_id,
            rule_type=AccessRuleType.ALLOW,
        ))
        conn.execute(AccessControlPolicy.__table__.insert().values(
            action=AccessActionType.WRITE,
            asset_type=Projects.__tablename__,
            asset_id=projects_id,
            principal_type=AppRole.__tablename__,
            principal_id=admin_role_id,
            rule_type=AccessRuleType.ALLOW,
        ))

        # Get the read role
        (read_role_id,) = conn.execute(sa.select([
            t_app_role.c.id
        ]).where(t_app_role.c.name == 'project-read')).fetchone()

        conn.execute(AccessControlPolicy.__table__.insert().values(
            action=AccessActionType.READ,
            asset_type=Projects.__tablename__,
            asset_id=projects_id,
            principal_type=AppRole.__tablename__,
            principal_id=read_role_id,
            rule_type=AccessRuleType.ALLOW,
        ))
        conn.execute(AccessControlPolicy.__table__.insert().values(
            action=AccessActionType.WRITE,
            asset_type=Projects.__tablename__,
            asset_id=projects_id,
            principal_type=AppRole.__tablename__,
            principal_id=read_role_id,
            rule_type=AccessRuleType.DENY,
        ))

        # Get the write role
        (write_role_id,) = conn.execute(sa.select([
            t_app_role.c.id
        ]).where(t_app_role.c.name == 'project-write')).fetchone()

        conn.execute(AccessControlPolicy.__table__.insert().values(
            action=AccessActionType.READ,
            asset_type=Projects.__tablename__,
            asset_id=projects_id,
            principal_type=AppRole.__tablename__,
            principal_id=write_role_id,
            rule_type=AccessRuleType.ALLOW,
        ))
        conn.execute(AccessControlPolicy.__table__.insert().values(
            action=AccessActionType.WRITE,
            asset_type=Projects.__tablename__,
            asset_id=projects_id,
            principal_type=AppRole.__tablename__,
            principal_id=write_role_id,
            rule_type=AccessRuleType.ALLOW,
        ))

        conn.execute(
            projects_collaborator_role.insert(),
            [dict(
                appuser_id=user_id,
                projects_id=projects_id,
                app_role_id=admin_role_id,
            )]
        )

        # Go through every map and assign directory id to map
        proj_ids = conn.execute(sa.select([
            t_project.c.id
        ]).where(t_project.c.user_id == user_id)).fetchall()
        for (proj_id,) in proj_ids:
            conn.execute(t_project
                         .update()
                         .where(t_project.c.id == proj_id)
                         .values(dir_id=directory_id))

        # Go through every file and assign directory id to file
        file_ids = conn.execute(sa.select([
            t_files.c.id
        ]).where(t_files.c.user_id == user_id)).fetchall()
        for (file_id,) in file_ids:
            conn.execute(t_files
                         .update()
                         .where(t_files.c.id == file_id)
                         .values(dict(dir_id=directory_id, project=projects_id)))


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
