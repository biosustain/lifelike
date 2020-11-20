"""merge 05938facc919 and 600460da634d

Revision ID: 93149c8d6de3
Revises: 05938facc919, 600460da634d
Create Date: 2020-11-20 18:02:43.819691

"""
from alembic import context
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '93149c8d6de3'
down_revision = ('05938facc919', '600460da634d')
branch_labels = None
depends_on = None


def upgrade():
    pass
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    pass
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
