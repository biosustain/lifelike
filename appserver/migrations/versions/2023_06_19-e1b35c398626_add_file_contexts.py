"""add file contexts

Revision ID: e1b35c398626
Revises: ad97ec0e4973
Create Date: 2023-06-19 13:53:47.753058

"""
from alembic import op
from os import path
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'e1b35c398626'
down_revision = 'ad97ec0e4973'
branch_labels = None
depends_on = None
directory = path.realpath(path.dirname(__file__))


def upgrade():
    op.add_column(
        'files',
        sa.Column('contexts', postgresql.JSONB, nullable=False, server_default='[]'),
    )


def downgrade():
    op.drop_column('files', 'contexts')
