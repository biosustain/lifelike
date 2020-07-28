"""Adds a directory structure to store projects and maps. Adds
access controls on the project level.

Revision ID: 3b70d9c2c76f
Revises: 868c69bf2137
Create Date: 2020-06-08 15:07:41.373581

"""
from alembic import context
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm.session import Session

from neo4japp.models import (
    AppRole,
    AppUser,
    AccessControlPolicy,
    AccessActionType,
    AccessRuleType,
    Directory,
    Files,
    Project,
    Projects,
    projects_collaborator_role,
)

# revision identifiers, used by Alembic.
revision = '3b70d9c2c76f'
down_revision = '868c69bf2137'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('directory',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('name', sa.String(length=200), nullable=False),
    sa.Column('directory_parent_id', sa.BigInteger(), nullable=True),
    sa.Column('projects_id', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['directory_parent_id'], ['directory.id'], name=op.f('fk_directory_directory_parent_id_directory')),
    sa.ForeignKeyConstraint(['projects_id'], ['projects.id'], name=op.f('fk_directory_projects_id_projects')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_directory'))
    )
    op.create_table('projects_collaborator_role',
    sa.Column('appuser_id', sa.Integer(), nullable=False),
    sa.Column('app_role_id', sa.Integer(), nullable=False),
    sa.Column('projects_id', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['app_role_id'], ['app_role.id'], name=op.f('fk_projects_collaborator_role_app_role_id_app_role'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['appuser_id'], ['appuser.id'], name=op.f('fk_projects_collaborator_role_appuser_id_appuser'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['projects_id'], ['projects.id'], name=op.f('fk_projects_collaborator_role_projects_id_projects'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('appuser_id', 'app_role_id', 'projects_id', name=op.f('pk_projects_collaborator_role'))
    )
    op.add_column('files', sa.Column('dir_id', sa.Integer(), nullable=True))
    op.create_foreign_key(op.f('fk_files_dir_id_directory'), 'files', 'directory', ['dir_id'], ['id'])
    op.add_column('project', sa.Column('dir_id', sa.Integer(), nullable=True))
    op.create_foreign_key(op.f('fk_project_dir_id_directory'), 'project', 'directory', ['dir_id'], ['id'])
    # ### end Alembic commands ###
    session = Session(op.get_bind())

    actions = postgresql.ENUM('READ', 'WRITE', name='accessactiontype')
    actions.create(op.get_bind())

    op.alter_column('access_control_policy', 'action',
               existing_type=sa.VARCHAR(length=50),
               type_=sa.Enum('READ', 'WRITE', name='accessactiontype'),
               existing_nullable=False,
               postgresql_using="action::accessactiontype")

    # There's only one hardcoded project right now
    projects = session.query(Projects).filter(Projects.project_name == 'beta-project').one_or_none()

    # This will only be true in development
    if not projects:
        projects = Projects(
            project_name='beta-project',
            description='',
            users=[],
        )
        session.add(projects)
        session.flush()
    else:
        # Setup roles for the existing project
        read_role = AppRole(name='project-read')
        write_role = AppRole(name='project-write')
        admin_role = AppRole(name='project-admin')
        session.add(read_role)
        session.add(write_role)
        session.add(admin_role)
        session.flush()

        # Sets up the 'READ' role
        session.execute(AccessControlPolicy.__table__.insert().values(
            action=AccessActionType.READ,
            asset_type=Projects.__tablename__,
            asset_id=projects.id,
            principal_type=AppRole.__tablename__,
            principal_id=read_role.id,
            rule_type=AccessRuleType.ALLOW,
        ))
        session.execute(AccessControlPolicy.__table__.insert().values(
            action=AccessActionType.WRITE,
            asset_type=Projects.__tablename__,
            asset_id=projects.id,
            principal_type=AppRole.__tablename__,
            principal_id=read_role.id,
            rule_type=AccessRuleType.DENY,
        ))

        # Sets up the 'WRITE' role
        session.execute(AccessControlPolicy.__table__.insert().values(
            action=AccessActionType.READ,
            asset_type=Projects.__tablename__,
            asset_id=projects.id,
            principal_type=AppRole.__tablename__,
            principal_id=write_role.id,
            rule_type=AccessRuleType.ALLOW,
        ))
        session.execute(AccessControlPolicy.__table__.insert().values(
            action=AccessActionType.WRITE,
            asset_type=Projects.__tablename__,
            asset_id=projects.id,
            principal_type=AppRole.__tablename__,
            principal_id=write_role.id,
            rule_type=AccessRuleType.ALLOW,
        ))

        # Sets up the 'ADMIN' role
        session.execute(AccessControlPolicy.__table__.insert().values(
            action=AccessActionType.READ,
            asset_type=Projects.__tablename__,
            asset_id=projects.id,
            principal_type=AppRole.__tablename__,
            principal_id=admin_role.id,
            rule_type=AccessRuleType.ALLOW,
        ))
        session.execute(AccessControlPolicy.__table__.insert().values(
            action=AccessActionType.WRITE,
            asset_type=Projects.__tablename__,
            asset_id=projects.id,
            principal_type=AppRole.__tablename__,
            principal_id=admin_role.id,
            rule_type=AccessRuleType.ALLOW,
        ))

        session.flush()

    # Bucket everything into a single directory
    t_directory = sa.Table(
        'directory',
        sa.MetaData(),
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column(
            'directory_parent_id',
            sa.Integer,
            sa.ForeignKey('directory.id'),
            nullable=True,
        ),
        sa.Column(
            'projects_id',
            sa.Integer,
            sa.ForeignKey('projects.id'),
            nullable=False,
        )
    )
    conn = op.get_bind()
    directory_id = conn.execute(
        t_directory.insert().values(
            name='/',
            directory_parent_id=None,
            projects_id=projects.id,
        )
    )

    # Get writer role
    write_role = session.query(AppRole).filter(
        AppRole.name == 'project-write'
    ).one()

    # Set all existing users to write role
    for user in session.query(AppUser).all():
        session.execute(
            projects_collaborator_role.insert(),
            [dict(
                appuser_id=user.id,
                projects_id=projects.id,
                app_role_id=write_role.id,
            )]
        )
        session.flush()

    for fi in session.query(Files).all():
        setattr(fi, 'dir_id', directory_id)
        session.add(fi)

    for proj in session.query(Project).all():
        setattr(proj, 'dir_id', directory_id)
        session.add(proj)

    session.commit()

    op.alter_column('files', 'dir_id', nullable=False)
    op.alter_column('project', 'dir_id', nullable=False)

    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_constraint(op.f('fk_project_dir_id_directory'), 'project', type_='foreignkey')
    op.drop_column('project', 'dir_id')
    op.drop_constraint(op.f('fk_files_dir_id_directory'), 'files', type_='foreignkey')
    op.drop_column('files', 'dir_id')
    op.alter_column('access_control_policy', 'action',
               existing_type=sa.Enum('READ', 'WRITE', name='accessactiontype'),
               type_=sa.VARCHAR(length=50),
               existing_nullable=False)
    op.drop_table('projects_collaborator_role')
    op.drop_table('directory')
    # ### end Alembic commands ###
    # NOTE: In practice perfect downgrades are difficult and in some cases
    # impossible! It is more practical to use database backups/snapshots to
    # "downgrade" the database. Changes to the database that we intend to
    # push to production should always be added to a NEW migration.
    # (i.e. "downgrade forward"!)


def data_upgrades():
    """Add optional data upgrade migrations here"""
    pass


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
