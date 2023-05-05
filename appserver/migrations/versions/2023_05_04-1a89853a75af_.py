"""Add transaction tasks table

Revision ID: 1a89853a75af
Revises: ad97ec0e4973
Create Date: 2023-05-04 19:41:13.250651

"""
import sqlalchemy as sa

from alembic import op
from os import path
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '1a89853a75af'
down_revision = 'ad97ec0e4973'
branch_labels = None
depends_on = None
directory = path.realpath(path.dirname(__file__))


def upgrade():
    op.create_table('transaction_task',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('transaction_id', sa.String(length=64), nullable=False),
        sa.Column('detail', postgresql.JSONB, nullable=True, server_default='[]'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_transaction_task'))
    )


def downgrade():
    op.drop_table('transaction_task')
