"""Add unique constrain on map_links

Revision ID: 55d9a626454f
Revises: 580187b42c7b
Create Date: 2022-09-22 15:26:10.117758

"""
from alembic import context
from alembic import op
import sqlalchemy as sa
from sqlalchemy.orm import Session

# revision identifiers, used by Alembic.
revision = '55d9a626454f'
down_revision = '580187b42c7b'
branch_labels = None
depends_on = None

def upgrade():
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()

    op.create_unique_constraint("uq_map_id_linked_id", "map_links", ["map_id", "linked_id"])


def downgrade():
    op.drop_constraint('uq_map_id_linked_id')


def data_upgrades():
    """Add optional data upgrade migrations here"""
    conn = op.get_bind()
    session = Session(conn)
    map_links = sa.table(
        'map_links',
        sa.column('entry_id', sa.PrimaryKey),
        sa.column('map_id', sa.Integer),
        sa.column('linked_id', sa.Integer)
    )
    unique = session.query(sa.func.min(map_links.entry_id)).group_by(map_links.map_id, map_links.linked_id)
    alias_unique = sa.aliased(unique)
    session.delete(map_links) \
        .where(~map_links.id.in_(alias_unique))
    session.commit()
