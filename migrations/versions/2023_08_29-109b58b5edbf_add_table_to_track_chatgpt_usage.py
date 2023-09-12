"""Add table to track ChatGPT usage

Revision ID: 109b58b5edbf
Revises: eb9ab3ce66ee
Create Date: 2023-08-29 10:59:50.555717

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '109b58b5edbf'
down_revision = 'eb9ab3ce66ee'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'chatgpt_usage',
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True),
        sa.Column(
            'user_id',
            sa.Integer(),
            sa.ForeignKey('appuser.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column('usage', postgresql.JSONB, nullable=False),
    )


def downgrade():
    op.drop_table('chatgpt_usage')
