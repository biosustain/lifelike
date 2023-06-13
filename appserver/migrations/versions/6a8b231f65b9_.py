"""Dropped the old lmdbs_date table for a new lmdb table. This has the hash for the lmdb files.

Revision ID: 6a8b231f65b9
Revises: e897a11b7b11
Create Date: 2021-07-02 19:57:33.739715

"""
from alembic import context
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '6a8b231f65b9'
down_revision = 'e897a11b7b11'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table(
        'lmdb',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=64), nullable=False),
        sa.Column('modified_date', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('checksum_md5', sa.String(length=32), nullable=False),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_lmdb')),
    )
    op.create_index(op.f('ix_lmdb_checksum_md5'), 'lmdb', ['checksum_md5'], unique=True)
    op.drop_table('lmdbs_dates')
    # ### end Alembic commands ###
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table(
        'lmdbs_dates',
        sa.Column('name', sa.VARCHAR(length=256), autoincrement=False, nullable=False),
        sa.Column(
            'date',
            postgresql.TIMESTAMP(timezone=True),
            autoincrement=False,
            nullable=False,
        ),
        sa.PrimaryKeyConstraint('name', name='pk_lmdbs_dates'),
    )
    op.drop_index(op.f('ix_lmdb_checksum_md5'), table_name='lmdb')
    op.drop_table('lmdb')
    # ### end Alembic commands ###
    # NOTE: In practice perfect downgrades are difficult and in some cases
    # impossible! It is more practical to use database backups/snapshots to
    # "downgrade" the database. Changes to the database that we intend to
    # push to production should always be added to a NEW migration.
    # (i.e. "downgrade forward"!)


def data_upgrades():
    """Add optional data upgrade migrations here"""
    pass


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
