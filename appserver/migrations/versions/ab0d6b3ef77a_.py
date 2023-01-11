"""Reset all user login failure counts to 0

Revision ID: ab0d6b3ef77a
Revises: cfe30b3ab56c
Create Date: 2022-09-27 23:41:03.479331

"""

from alembic import context, op
import sqlalchemy as sa
from sqlalchemy.orm import Session

from migrations.utils import window_chunk

# revision identifiers, used by Alembic.
revision = 'ab0d6b3ef77a'
down_revision = 'cfe30b3ab56c'
branch_labels = None
depends_on = None


def upgrade():
    pass
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    pass


def data_upgrades():
    """Add optional data upgrade migrations here"""
    conn = op.get_bind()
    session = Session(conn)

    t_appuser = sa.table(
        'appuser',
        sa.column('id', sa.Integer),
    )

    files = conn.execution_options(stream_results=True).execute(sa.select([
        t_appuser.c.id,
    ]))

    for chunk in window_chunk(files, 25):
        appusers_to_update = []
        for id, in chunk:
            appusers_to_update.append({'id': id, 'failed_login_count': 0})
        try:
            session.bulk_update_mappings(t_appuser, appusers_to_update)
            session.commit()
        except Exception:
            raise
