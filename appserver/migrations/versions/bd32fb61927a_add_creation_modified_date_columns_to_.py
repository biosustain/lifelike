"""Add creation/modified date columns to tables

Revision ID: bd32fb61927a
Revises: a6f4dec3a2d6
Create Date: 2020-08-26 22:42:37.828585

"""
from alembic import context
from alembic import op
import sqlalchemy as sa
from sqlalchemy.orm.session import Session
from sqlalchemy.sql import table, column

from neo4japp.database import db


# revision identifiers, used by Alembic.
revision = 'bd32fb61927a'
down_revision = 'a6f4dec3a2d6'
branch_labels = None
depends_on = None


t_appuser = table(
    'appuser',
    column('creation_date', sa.DateTime),
    column('modified_date', sa.DateTime),
)

t_directory = table(
    'directory',
    column('creation_date', sa.DateTime),
    column('modified_date', sa.DateTime),
)

t_files = table(
    'files',
    column('modified_date', sa.DateTime),
)

t_global_list = table(
    'global_list',
    column('creation_date', sa.DateTime),
    column('modified_date', sa.DateTime),
)

t_project = table(
    'project',
    column('creation_date', sa.DateTime),
    column('date_modified', sa.DateTime),
)

t_project_backup = table(
    'project_backup',
    column('creation_date', sa.DateTime),
    column('date_modified', sa.DateTime),
)

t_projects = table(
    'projects',
    column('modified_date', sa.DateTime),
)

t_worksheets = table(
    'worksheets',
    column('modified_date', sa.DateTime),
)


def upgrade():
    op.add_column('appuser', sa.Column('creation_date', sa.DateTime(), nullable=True))
    op.add_column('appuser', sa.Column('modified_date', sa.DateTime(), nullable=True))
    op.add_column('directory', sa.Column('creation_date', sa.DateTime(), nullable=True))
    op.add_column('directory', sa.Column('modified_date', sa.DateTime(), nullable=True))
    op.add_column('files', sa.Column('modified_date', sa.DateTime(), nullable=True))
    op.add_column('global_list', sa.Column('creation_date', sa.DateTime(), nullable=True))
    op.add_column('global_list', sa.Column('modified_date', sa.DateTime(), nullable=True))
    op.add_column('project', sa.Column('creation_date', sa.DateTime(), nullable=True))
    op.add_column('project_backup', sa.Column('creation_date', sa.DateTime(), nullable=True))
    op.add_column('projects', sa.Column('modified_date', sa.DateTime(), nullable=True))
    op.add_column('worksheets', sa.Column('modified_date', sa.DateTime(), nullable=True))

    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    op.drop_column('worksheets', 'modified_date')
    op.drop_column('projects', 'modified_date')
    op.drop_column('project_backup', 'creation_date')
    op.drop_column('project', 'creation_date')
    op.drop_column('global_list', 'modified_date')
    op.drop_column('global_list', 'creation_date')
    op.drop_column('files', 'modified_date')
    op.drop_column('directory', 'modified_date')
    op.drop_column('directory', 'creation_date')
    op.drop_column('appuser', 'modified_date')
    op.drop_column('appuser', 'creation_date')


def data_upgrades():
    """Add optional data upgrade migrations here"""
    session = Session(op.get_bind())

    # appuser -> creation/modified
    session.execute(
        t_appuser.update().values(
            creation_date=db.func.now(),
            modified_date=db.func.now()
        )
    )

    # directpry -> creation/modified
    session.execute(
        t_directory.update().values(
            creation_date=db.func.now(),
            modified_date=db.func.now()
        )
    )

    # files -> modified
    session.execute(
        t_files.update().values(
            modified_date=db.func.now()
        )
    )

    # global_list -> creation/modified
    session.execute(
        t_global_list.update().values(
            creation_date=db.func.now(),
            modified_date=db.func.now()
        )
    )

    # project -> creation
    session.execute(
        t_project.update().values(
            creation_date=db.func.now(),
            date_modified=db.func.now()
        )
    )

    # project_backup -> creation
    session.execute(
        t_project_backup.update().values(
            creation_date=db.func.now(),
            date_modified=db.func.now()
        )
    )

    # projects -> modified
    session.execute(
        t_projects.update().values(
            modified_date=db.func.now()
        )
    )

    # worksheets -> modified
    session.execute(
        t_worksheets.update().values(
            modified_date=db.func.now()
        )
    )


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
