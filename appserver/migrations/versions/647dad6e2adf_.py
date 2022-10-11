"""Increase max len of `hash_id` column on files table

Revision ID: 647dad6e2adf
Revises: 580187b42c7b
Create Date: 2022-09-21 22:35:04.792597

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '647dad6e2adf'
down_revision = '580187b42c7b'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        'files',
        'hash_id',
        type_=sa.VARCHAR(length=86),
    )


def downgrade():
    pass
