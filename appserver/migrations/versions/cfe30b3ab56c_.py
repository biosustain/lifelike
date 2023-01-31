"""Update all file paths to correct values

Revision ID: cfe30b3ab56c
Revises: 55d9a626454f
Create Date: 2022-09-26 19:43:01.495090

"""
from alembic import context, op
import sqlalchemy as sa
from sqlalchemy.orm import Session

from migrations.utils import window_chunk
# flake8: noqa: OIG001 # It is legacy file with imports from appserver which we decided to not fix
from neo4japp.models import Files


# revision identifiers, used by Alembic.
revision = 'cfe30b3ab56c'
down_revision = '55d9a626454f'
branch_labels = None
depends_on = None


def upgrade():
    pass
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
    session = Session(conn)

    t_files = sa.table(
        'files',
        sa.column('id', sa.Integer),
        sa.column('filename', sa.String),
        sa.column('parent_id', sa.Integer),
        sa.column('modified_date', sa.TIMESTAMP(timezone=True))
    )

    t_projects = sa.table(
        'projects',
        sa.column('id', sa.Integer),
        sa.column('name', sa.String),
        sa.column('***ARANGO_USERNAME***_id', sa.Integer)
    )

    def _get_file_path(file_id, parent_id, filename):
        """
        Gets a list of Files representing the path to this file.
        """
        current_file = file_id
        current_parent = parent_id
        file_path = []
        while current_parent is not None:
            # Ignore top level filenames, we'll get the proper name from the parent project later
            file_path.append(filename)
            current_file, current_parent, filename = conn.execution_options(
                stream_results=True
            ).execute(
                sa.select([
                    t_files.c.id,
                    t_files.c.parent_id,
                    t_files.c.filename,
                ]).where(
                    t_files.c.id == current_parent
                )
            ).first()
        project_name = conn.execution_options(stream_results=True).execute(sa.select([
                t_projects.c.name,
            ]).where(
                t_projects.c.***ARANGO_USERNAME***_id == current_file
            )
        ).scalar()

        # This *should never* happen. But, we have a single weird file on staging that has no
        # children and no associated project. Yet another reason to refactor the projects table...
        if project_name is None:
            return '/'

        file_path.append(project_name)

        return '/' + '/'.join(file_path[::-1])

    files = conn.execution_options(stream_results=True).execute(sa.select([
        t_files.c.id,
        t_files.c.parent_id,
        t_files.c.filename,
        t_files.c.modified_date

    ]))

    for chunk in window_chunk(files, 25):
        files_to_update = []
        for id, parent_id, filename, modified_date in chunk:
            path = _get_file_path(id, parent_id, filename)
            # Include the existing modified date here to make sure the ORM doesn't automatically
            # update it
            files_to_update.append({'id': id, 'path': path, 'modified_date': modified_date})
        try:
            session.bulk_update_mappings(Files, files_to_update)
            session.commit()
        except Exception:
            raise


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
