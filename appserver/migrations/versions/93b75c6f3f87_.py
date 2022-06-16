"""Add path column to files

Revision ID: 93b75c6f3f87
Revises: 3234be6a4bd8
Create Date: 2022-05-23 23:38:47.777414

"""

from alembic import context, op
import sqlalchemy as sa
from sqlalchemy.orm import Session

from migrations.utils import window_chunk
from neo4japp.models import Files


# revision identifiers, used by Alembic.
revision = '93b75c6f3f87'
down_revision = '3234be6a4bd8'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('files', sa.Column('path', sa.Text(), nullable=True))

    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()

    op.alter_column(
        'files',
        'path',
        nullable=False
    )


def downgrade():
    op.drop_column('files', 'path')


def data_upgrades():
    """Add optional data upgrade migrations here"""
    conn = op.get_bind()
    session = Session(conn)

    t_files = sa.table(
        'files',
        sa.column('id', sa.Integer),
        sa.column('filename', sa.String),
        sa.column('parent_id', sa.Integer)
    )

    t_projects = sa.table(
        'projects',
        sa.column('id', sa.Integer),
        sa.column('name', sa.String),
        sa.column('root_id', sa.Integer)
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
                t_projects.c.root_id == current_file
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
        t_files.c.filename
    ]))

    for chunk in window_chunk(files, 25):
        files_to_update = []
        for id, parent_id, filename in chunk:
            path = _get_file_path(id, parent_id, filename)
            files_to_update.append({'id': id, 'path': path})
        try:
            session.bulk_update_mappings(Files, files_to_update)
            session.commit()
        except Exception:
            raise
