"""Increase max len of `hash_id` column on all tables

Revision ID: 647dad6e2adf
Revises: ab0d6b3ef77a
Create Date: 2022-09-21 22:35:04.792597

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '647dad6e2adf'
down_revision = 'ab0d6b3ef77a'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        'files',
        'hash_id',
        type_=sa.VARCHAR(length=86),
    )

    op.alter_column(
        'appuser',
        'hash_id',
        type_=sa.VARCHAR(length=86),
    )

    op.alter_column(
        'file_annotations_version',
        'hash_id',
        type_=sa.VARCHAR(length=86),
    )

    op.alter_column(
        'file_version',
        'hash_id',
        type_=sa.VARCHAR(length=86),
    )

    op.alter_column(
        'file_backup',
        'hash_id',
        type_=sa.VARCHAR(length=86),
    )

    op.alter_column(
        'projects',
        'hash_id',
        type_=sa.VARCHAR(length=86),
    )


def downgrade():
    pass
