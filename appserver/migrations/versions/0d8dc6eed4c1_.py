"""Insert stop words into new stop words table.

Revision ID: 0d8dc6eed4c1
Revises: 09f100e842ad
Create Date: 2020-08-04 21:18:22.308992

"""
from alembic import context
from alembic import op
import sqlalchemy as sa
from sqlalchemy.orm.session import Session
from sqlalchemy.sql import table, column
from sqlalchemy.dialects import postgresql

from os import path


# revision identifiers, used by Alembic.
revision = '0d8dc6eed4c1'
down_revision = '09f100e842ad'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('annotation_stop_words',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('word', sa.String(length=80), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_annotation_stop_words'))
    )
    # ### end Alembic commands ###
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table('annotation_stop_words')
    # ### end Alembic commands ###
    # NOTE: In practice perfect downgrades are difficult and in some cases
    # impossible! It is more practical to use database backups/snapshots to
    # "downgrade" the database. Changes to the database that we intend to
    # push to production should always be added to a NEW migration.
    # (i.e. "downgrade forward"!)


def data_upgrades():
    """Add optional data upgrade migrations here"""
    # reference to this directory
    directory = path.realpath(path.dirname(__file__))

    stop_words_file = path.join(directory, 'upgrade_data', 'annotation_stop_words.txt')

    session = Session(op.get_bind())

    _table = table('annotation_stop_words', column('word', sa.String))

    inserts= []
    with open(stop_words_file, 'r') as f:
        for line in f:
            inserts.append({'word': line.rstrip()})
    session.execute(_table.insert(), inserts)
    session.commit()


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
