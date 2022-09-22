"""Add unique constrain on map_links

Revision ID: 55d9a626454f
Revises: 580187b42c7b
Create Date: 2022-09-22 15:26:10.117758

"""
from alembic import context
from alembic import op
import sqlalchemy as sa

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

    t_map_links = sa.table(
        'map_links',
        sa.column('entry_id', sa.Integer),
        sa.column('map_id', sa.Integer),
        sa.column('linked_id', sa.Integer)
    )

    conn.execute(
        sa.delete(
            t_map_links
        ).where(
            ~t_map_links.c.entry_id.in_(
                sa.select([
                   sa.func.min(t_map_links.c.entry_id)
                ]).group_by(
                    t_map_links.c.map_id,
                    t_map_links.c.linked_id
                )
            )
        )
    )
