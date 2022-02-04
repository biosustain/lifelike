"""Add subject column to appuser

Revision ID: 7102b4744622
Revises: b49193a949a6
Create Date: 2022-02-04 01:59:44.977808

"""
from alembic import context
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '7102b4744622'
down_revision = 'b49193a949a6'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('appuser', sa.Column('subject', sa.String(length=256), nullable=True))


def downgrade():
    op.drop_column('appuser', 'subject')


def data_upgrades():
    """Add optional data upgrade migrations here"""
    pass


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
