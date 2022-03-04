"""Add subject column to appuser

Revision ID: 7102b4744622
Revises: b49193a949a6
Create Date: 2022-02-04 01:59:44.977808

"""
from alembic import context
from alembic import op
import sqlalchemy as sa
from sqlalchemy import table, column
from sqlalchemy.orm.session import Session

from migrations.utils import window_chunk
from neo4japp.models import AppUser

# revision identifiers, used by Alembic.
revision = '7102b4744622'
down_revision = 'b49193a949a6'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('appuser', sa.Column('subject', sa.String(length=256), nullable=True))

    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()

    op.alter_column(
        'appuser',
        'subject',
        existing_type=sa.String(length=256),
        nullable=False
    )


def downgrade():
    op.drop_column('appuser', 'subject')


def data_upgrades():
    """Add optional data upgrade migrations here"""
    conn = op.get_bind()
    session = Session(conn)

    t_appuser = table(
        'appuser',
        column('id', sa.Integer),
        column('email', sa.String))

    files = conn.execution_options(stream_results=True).execute(sa.select([
        t_appuser.c.id,
        t_appuser.c.email
    ]))

    for chunk in window_chunk(files, 20):
        files_to_update = []
        for id, email in chunk:
            files_to_update.append({'id': id, 'subject': email})
        try:
            session.bulk_update_mappings(AppUser, files_to_update)
            session.commit()
        except Exception:
            session.rollback()
            raise


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
