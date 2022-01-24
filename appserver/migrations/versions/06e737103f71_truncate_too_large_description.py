"""Truncate too large description.

Revision ID: 06e737103f71
Revises: 65d827e55b5b
Create Date: 2022-01-17 17:32:43.819103

"""
from alembic import context
from alembic import op
import sqlalchemy as sa
from sqlalchemy import table, column
from sqlalchemy.orm.session import Session

from migrations.utils import window_chunk
from neo4japp.models import Files


# revision identifiers, used by Alembic.
revision = '06e737103f71'
down_revision = '65d827e55b5b'
branch_labels = None
depends_on = None
MAX_FILE_DESCRIPTION_LENGTH = 5000


def upgrade():
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    pass


def data_upgrades():
    conn = op.get_bind()
    session = Session(conn)

    session.expire_on_commit = False

    t_files = table(
        'files',
        column('id', sa.Integer),
        column('description', sa.String))

    files = conn.execution_options(stream_results=True).execute(sa.select([
        t_files.c.id,
        t_files.c.description
    ]))

    for chunk in window_chunk(files, 1):
        files_to_update = []
        for id, description in chunk:
            if description and len(description) > MAX_FILE_DESCRIPTION_LENGTH:
                files_to_update.append({'id': id,
                                        'description': description[:MAX_FILE_DESCRIPTION_LENGTH]})
        try:
            session.bulk_update_mappings(Files, files_to_update)
            session.commit()
        except Exception:
            session.rollback()
            raise


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
