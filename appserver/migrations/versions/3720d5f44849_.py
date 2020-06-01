"""Adds directories to projects as well
as a junction table for permissions on
projects

Revision ID: 3720d5f44849
Revises: ca18fa3cdbb5
Create Date: 2020-05-27 19:32:01.159071

"""
from alembic import context
from alembic import op
import sqlalchemy as sa

from sqlalchemy.orm.session import Session

from neo4japp.models import Directory, Files, Project, Projects

# revision identifiers, used by Alembic.
revision = '3720d5f44849'
down_revision = 'ca18fa3cdbb5'
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
    op.create_table('project_user_role',
    sa.Column('appuser_id', sa.Integer(), nullable=False),
    sa.Column('app_role_id', sa.Integer(), nullable=False),
    sa.Column('project_id', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['app_role_id'], ['app_role.id'], name=op.f('fk_project_user_role_app_role_id_app_role'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['appuser_id'], ['appuser.id'], name=op.f('fk_project_user_role_appuser_id_appuser'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['project_id'], ['project.id'], name=op.f('fk_project_user_role_project_id_project'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('appuser_id', 'app_role_id', 'project_id', name=op.f('pk_project_user_role'))
    )

    op.add_column('files', sa.Column('dir_id', sa.Integer(), nullable=True))
    op.create_foreign_key(op.f('fk_files_dir_id_directory'), 'files', 'directory', ['dir_id'], ['id'])

    op.add_column('project', sa.Column('dir_id', sa.Integer(), nullable=True))
    op.create_foreign_key(op.f('fk_project_dir_id_directory'), 'project', 'directory', ['dir_id'], ['id'])
    # ### end Alembic commands ###
    session = Session(op.get_bind())

    # There's only one hardcoded project right now
    projects = session.query(Projects).one_or_none()

    # This will only be true in development
    if not projects:
        projects = Projects(
            project_name='default',
            description='',
            users=[],
        )
        session.add(projects)
        session.flush()

    # Bucket everything into a single directory
    directory = Directory(
        name='beta-project',
        directory_parent_id=None,
        projects_id=projects.id,
    )

    session.add(directory)
    session.flush()

    for fi in session.query(Files).all():
        setattr(fi, 'dir_id', directory.id)
        session.add(fi)

    for proj in session.query(Project).all():
        setattr(proj, 'dir_id', directory.id)
        session.add(proj)

    session.commit()

    op.alter_column('files', 'dir_id', nullable=False)
    op.alter_column('project', 'dir_id', nullable=False)


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_constraint(op.f('fk_project_dir_id_directory'), 'project', type_='foreignkey')
    op.drop_column('project', 'dir_id')
    op.drop_constraint(op.f('fk_files_dir_id_directory'), 'files', type_='foreignkey')
    op.drop_column('files', 'dir_id')
    op.drop_table('project_user_role')
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
