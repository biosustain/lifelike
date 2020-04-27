"""Table schema for files.

Had to update migration file itself, rather
than a new migration file... The reason was
because changed the `id` column to Integer,
and there wasn't an easy way to set a default
value to autoincrement the primary key of an
existing column with alembic.

The `file_id` column replaced the original
purpose of the `id` column.

Revision ID: 59b6851c654e
Revises: e3afdf1adbd2
Create Date: 2020-04-03 11:52:12.693738

"""
from alembic import context
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '59b6851c654e'
down_revision = 'e3afdf1adbd2'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table(
        'files',
        sa.Column('id', sa.Integer(), nullable=False, autoincrement=True),
        sa.Column('filename', sa.String(length=60), nullable=True),
        sa.Column('file_id', sa.String(length=36), nullable=False),
        sa.Column('raw_file', sa.LargeBinary(), nullable=False),
        sa.Column('username', sa.String(length=30), nullable=True),
        sa.Column('creation_date', sa.DateTime(), nullable=True),
        sa.Column('annotations',
                  postgresql.JSONB(astext_type=sa.Text()),
                  server_default='[]',
                  nullable=False),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_files')),
        sa.UniqueConstraint('file_id', name=op.f('uq_files_file_id')),
    )
    # ### end Alembic commands ###
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table('files')
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
