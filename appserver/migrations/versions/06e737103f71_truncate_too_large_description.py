"""Truncate too large description.
As there was no validation on sankey description, some of those might be longer than our
system allows. The new files are going to be validated, but we might want to fix the old ones

Revision ID: 06e737103f71
Revises: 65d827e55b5b
Create Date: 2022-01-17 17:32:43.819103

"""
from alembic import context
from alembic import op
import sqlalchemy as sa
from sqlalchemy import table, column
from sqlalchemy.orm import Session

from migrations.utils import window_chunk
MAX_FILE_DESCRIPTION_LENGTH = 5000

# revision identifiers, used by Alembic.
revision = '06e737103f71'
down_revision = '65d827e55b5b'
branch_labels = None
depends_on = None


def upgrade():
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    pass


def data_upgrades():
    conn = op.get_bind()
    session = Session(conn)

    t_files = table(
        'files',
        column('id', sa.Integer),
        column('description', sa.String))

    files = conn.execution_options(stream_results=True).execute(sa.select([
        t_files.c.id,
        t_files.c.description
    ]))

    for chunk in window_chunk(files, 25):
        files_to_update = []
        for id, description in chunk:
            if len(description) > MAX_FILE_DESCRIPTION_LENGTH:
                files_to_update.append({'id': id,
                                        'description': description[:MAX_FILE_DESCRIPTION_LENGTH]})
        try:
            session.bulk_update_mappings(t_files, files_to_update)
            session.commit()
        except Exception:
            pass


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
