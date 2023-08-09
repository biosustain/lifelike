""" Add author for directory

Revision ID: 36d25e171658
Revises: cc345dcad75c
Create Date: 2020-07-22 19:25:59.212662

"""
from alembic import context
from alembic import op
import bcrypt
import enum
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy_utils.types import TSVectorType

# flake8: noqa: OIG001 # It is legacy file with imports from appserver which we decided to not fix
from neo4japp.models import (
    AppRole,
    Projects,
    projects_collaborator_role,
)


# Moved this here from the auth models file. We removed this class as part of 6b7a2da00472 because
# it was unused.
class AccessRuleType(enum.Enum):
    """Allow or Deny"""

    ALLOW = 'allow'
    DENY = 'deny'


# Moved this here from the auth models file. We removed this class as part of 6b7a2da00472 because
# it was unused.
class AccessActionType(enum.Enum):
    READ = 'read'
    WRITE = 'write'


# revision identifiers, used by Alembic.
revision = '36d25e171658'
down_revision = 'cc345dcad75c'
branch_labels = None
depends_on = None


# Table definitions
t_files_content = sa.Table(
    'files_content',
    sa.MetaData(),
    sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
    sa.Column('raw_file', sa.LargeBinary, nullable=True),
    sa.Column(
        'checksum_sha256', sa.Binary(32), nullable=False, index=True, unique=True
    ),
    sa.Column('creation_date', sa.DateTime, nullable=False, default=sa.func.now()),
)


t_files = sa.Table(
    'files',
    sa.MetaData(),
    sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
    sa.Column('filename', sa.String(60)),
    sa.Column(
        'content_id',
        sa.Integer,
        sa.ForeignKey(t_files_content.c.id, ondelete='CASCADE'),
    ),
    sa.Column('raw_file', sa.LargeBinary, nullable=True),
    sa.Column(
        'dir_id',
        sa.Integer,
        sa.ForeignKey('directory.id'),
        nullable=False,
    ),
    sa.Column(
        'user_id',
        sa.Integer,
        sa.ForeignKey('appuser.id'),
        nullable=False,
    ),
)

t_directory = sa.Table(
    'directory',
    sa.MetaData(),
    sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
    sa.Column('name', sa.String(200), nullable=False),
    sa.Column(
        'directory_parent_id',
        sa.Integer,
        sa.ForeignKey('directory.id'),
        nullable=False,
    ),
    sa.Column(
        'projects_id',
        sa.Integer,
        sa.ForeignKey('projects.id'),
        nullable=False,
    ),
    sa.Column(
        'user_id',
        sa.Integer,
        sa.ForeignKey('appuser.id'),
        nullable=False,
    ),
)

t_app_user = sa.Table(
    'appuser',
    sa.MetaData(),
    sa.Column('id', sa.Integer(), primary_key=True),
    sa.Column('username', sa.String(64), index=True, unique=True),
    sa.Column('email', sa.String(120), index=True, unique=True),
    sa.Column('first_name', sa.String(120), nullable=False),
    sa.Column('last_name', sa.String(120), nullable=False),
    sa.Column('password_hash', sa.String(256)),
)

t_app_role = sa.Table(
    'app_role',
    sa.MetaData(),
    sa.Column('id', sa.Integer(), primary_key=True),
    sa.Column('name', sa.String(128), nullable=False, unique=True),
)

t_project = sa.Table(
    'project',
    sa.MetaData(),
    sa.Column('id', sa.Integer(), primary_key=True),
    sa.Column('label', sa.String(250), nullable=False),
    sa.Column('description', sa.Text),
    sa.Column('date_modified', sa.DateTime),
    sa.Column('graph', sa.JSON),
    sa.Column('author', sa.String(240), nullable=False),
    sa.Column('public', sa.Boolean(), default=False),
    sa.Column('user_id', sa.Integer, sa.ForeignKey(t_app_user.c.id)),
    sa.Column('dir_id', sa.Integer, sa.ForeignKey(t_directory.c.id)),
    sa.Column('hash_id', sa.String(50), unique=True),
    sa.Column('search_vector', TSVectorType('label')),
)

t_projects = sa.Table(
    'projects',
    sa.MetaData(),
    sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
    sa.Column('project_name', sa.String(250), unique=True, nullable=False),
    sa.Column('description', sa.Text),
    sa.Column('creation_date', sa.DateTime, nullable=False, default=sa.func.now()),
    sa.Column('users', sa.ARRAY(sa.Integer), nullable=False),
)


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table(
        'directory',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('directory_parent_id', sa.BigInteger(), nullable=True),
        sa.Column('projects_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ['user_id'], ['appuser.id'], name=op.f('fk_directory_user_id_appuser')
        ),
        sa.ForeignKeyConstraint(
            ['directory_parent_id'],
            ['directory.id'],
            name=op.f('fk_directory_directory_parent_id_directory'),
        ),
        sa.ForeignKeyConstraint(
            ['projects_id'],
            ['projects.id'],
            name=op.f('fk_directory_projects_id_projects'),
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_directory')),
    )

    op.create_table(
        'projects_collaborator_role',
        sa.Column('appuser_id', sa.Integer(), nullable=False),
        sa.Column('app_role_id', sa.Integer(), nullable=False),
        sa.Column('projects_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ['app_role_id'],
            ['app_role.id'],
            name=op.f('fk_projects_collaborator_role_app_role_id_app_role'),
            ondelete='CASCADE',
        ),
        sa.ForeignKeyConstraint(
            ['appuser_id'],
            ['appuser.id'],
            name=op.f('fk_projects_collaborator_role_appuser_id_appuser'),
            ondelete='CASCADE',
        ),
        sa.ForeignKeyConstraint(
            ['projects_id'],
            ['projects.id'],
            name=op.f('fk_projects_collaborator_role_projects_id_projects'),
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint(
            'appuser_id',
            'app_role_id',
            'projects_id',
            name=op.f('pk_projects_collaborator_role'),
        ),
    )
    op.add_column('files', sa.Column('dir_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        op.f('fk_files_dir_id_directory'), 'files', 'directory', ['dir_id'], ['id']
    )
    op.add_column('project', sa.Column('dir_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        op.f('fk_project_dir_id_directory'), 'project', 'directory', ['dir_id'], ['id']
    )

    actions = postgresql.ENUM('READ', 'WRITE', name='accessactiontype')
    actions.create(op.get_bind())

    op.alter_column(
        'access_control_policy',
        'action',
        existing_type=sa.VARCHAR(length=50),
        type_=sa.Enum('READ', 'WRITE', name='accessactiontype'),
        existing_nullable=False,
        postgresql_using="action::accessactiontype",
    )

    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()

    op.alter_column('files', 'dir_id', nullable=False)
    op.alter_column('project', 'dir_id', nullable=False)
    # ### end Alembic commands ###


def downgrade():
    pass
    # NOTE: In practice perfect downgrades are difficult and in some cases
    # impossible! It is more practical to use database backups/snapshots to
    # "downgrade" the database. Changes to the database that we intend to
    # push to production should always be added to a NEW migration.
    # (i.e. "downgrade forward"!)


def migration_fix():
    """
    Keeping this data migration for legacy purposes. It's mostly
    likely not needed, but having it within the data migration process
    at the moment prevents our test from being idempotent as it continously
    adds a user each time we spin up a test environment.

    We could potentially also have our start up script not run
    data migrations when running unit tests via environmental variables.
    """

    conn = op.get_bind()

    # There's only one hardcoded project right now
    row = conn.execute(
        sa.select([t_projects.c.id]).where(t_projects.c.project_name == 'beta-project')
    ).fetchone()

    read_role_id = conn.execute(
        t_app_role.insert().values(name='project-read')
    ).inserted_primary_key[0]
    write_role_id = conn.execute(
        t_app_role.insert().values(name='project-write')
    ).inserted_primary_key[0]
    admin_role_id = conn.execute(
        t_app_role.insert().values(name='project-admin')
    ).inserted_primary_key[0]

    # This will only be true in development
    if row is None:
        projects_id = conn.execute(
            t_projects.insert().values(
                project_name='beta-project',
                description='',
                users=[],
            )
        ).inserted_primary_key[0]

    else:
        (projects_id,) = row

        # Setup roles for the existing project
        t_access_control_policy = sa.Table(
            'access_control_policy',
            sa.MetaData(),
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('action', sa.String(length=50), nullable=False),
            sa.Column('asset_type', sa.String(length=200), nullable=False),
            sa.Column('asset_id', sa.Integer(), nullable=True),
            sa.Column('principal_type', sa.String(length=50), nullable=False),
            sa.Column('principal_id', sa.Integer(), nullable=True),
            sa.Column(
                'rule_type',
                sa.Enum('ALLOW', 'DENY', name='accessruletype'),
                nullable=False,
            ),
            sa.PrimaryKeyConstraint('id'),
        )

        # Sets up the 'READ' role
        conn.execute(
            t_access_control_policy.insert().values(
                action=AccessActionType.READ.name,
                asset_type=Projects.__tablename__,
                asset_id=projects_id,
                principal_type=AppRole.__tablename__,
                principal_id=read_role_id,
                rule_type=AccessRuleType.ALLOW.name,
            )
        )
        conn.execute(
            t_access_control_policy.insert().values(
                action=AccessActionType.WRITE.name,
                asset_type=Projects.__tablename__,
                asset_id=projects_id,
                principal_type=AppRole.__tablename__,
                principal_id=read_role_id,
                rule_type=AccessRuleType.DENY.name,
            )
        )

        # Sets up the 'WRITE' role
        conn.execute(
            t_access_control_policy.insert().values(
                action=AccessActionType.READ.name,
                asset_type=Projects.__tablename__,
                asset_id=projects_id,
                principal_type=AppRole.__tablename__,
                principal_id=write_role_id,
                rule_type=AccessRuleType.ALLOW.name,
            )
        )
        conn.execute(
            t_access_control_policy.insert().values(
                action=AccessActionType.WRITE.name,
                asset_type=Projects.__tablename__,
                asset_id=projects_id,
                principal_type=AppRole.__tablename__,
                principal_id=write_role_id,
                rule_type=AccessRuleType.ALLOW.name,
            )
        )

        # Sets up the 'ADMIN' role
        conn.execute(
            t_access_control_policy.insert().values(
                action=AccessActionType.READ.name,
                asset_type=Projects.__tablename__,
                asset_id=projects_id,
                principal_type=AppRole.__tablename__,
                principal_id=admin_role_id,
                rule_type=AccessRuleType.ALLOW.name,
            )
        )
        conn.execute(
            t_access_control_policy.insert().values(
                action=AccessActionType.WRITE.name,
                asset_type=Projects.__tablename__,
                asset_id=projects_id,
                principal_type=AppRole.__tablename__,
                principal_id=admin_role_id,
                rule_type=AccessRuleType.ALLOW.name,
            )
        )

    default_owner_id = conn.execute(
        sa.select([t_app_user.c.id]).where(t_app_user.c.email == 'test@***ARANGO_DB_NAME***.bio')
    ).fetchone()

    # This is only true in development
    # TODO: Move data migrations out of the dev process to keep
    # the database empty; in other words, defer to fixture seeding
    if default_owner_id is None:
        pwhash = bcrypt.hashpw('password'.encode('utf-8'), bcrypt.gensalt())
        default_owner_id = conn.execute(
            t_app_user.insert().values(
                dict(
                    username='demo',
                    email='demo@***ARANGO_DB_NAME***.bio',
                    first_name='demo',
                    last_name='demo',
                    password_hash=pwhash.decode('utf-8'),
                )
            )
        ).inserted_primary_key

    # Bucket everything into a single directory
    directory_id = conn.execute(
        t_directory.insert().values(
            name='/',
            directory_parent_id=None,
            projects_id=projects_id,
            user_id=default_owner_id[0],
        )
    ).inserted_primary_key[0]

    # Get writer role
    write_role_id = conn.execute(
        sa.select([t_app_role.c.id]).where(t_app_role.c.name == 'project-write')
    ).fetchone()

    # Set all existing users to write role
    user_ids = conn.execute(sa.select([t_app_user.c.id])).fetchall()

    for user_id in user_ids:
        conn.execute(
            projects_collaborator_role.insert(),
            [
                dict(
                    appuser_id=user_id[0],
                    projects_id=projects_id,
                    app_role_id=write_role_id[0],
                )
            ],
        )

    file_ids = conn.execute(sa.select([t_files.c.id])).fetchall()
    for file_id in file_ids:
        conn.execute(
            t_files.update()
            .where(t_files.c.id == file_id[0])
            .values(dir_id=directory_id)
        )

    proj_ids = conn.execute(sa.select([t_project.c.id])).fetchall()
    for proj_id in proj_ids:
        conn.execute(
            t_project.update()
            .where(t_project.c.id == proj_id[0])
            .values(dir_id=directory_id)
        )


def data_upgrades():
    """Add optional data upgrade migrations here"""
    pass


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
