"""Update old annotations to have the new primaryName JSON property.

Revision ID: e4e01bc5ad23
Revises: b90a32885a8f
Create Date: 2020-12-02 18:54:06.498369

"""
from alembic import context
from alembic import op
import sqlalchemy as sa

from sqlalchemy.orm.session import Session
from sqlalchemy.sql import table, column
from sqlalchemy.dialects import postgresql

from migrations.utils import update_annotations, update_annotations_add_primary_name


# revision identifiers, used by Alembic.
revision = 'e4e01bc5ad23'
down_revision = 'b90a32885a8f'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    pass
    # ### end Alembic commands ###
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    pass
    # ### end Alembic commands ###
    # NOTE: In practice perfect downgrades are difficult and in some cases
    # impossible! It is more practical to use database backups/snapshots to
    # "downgrade" the database. Changes to the database that we intend to
    # push to production should always be added to a NEW migration.
    # (i.e. "downgrade forward"!)


def data_upgrades():
    """Add optional data upgrade migrations here"""
    conn = op.get_bind()
    session = Session(conn)

    tableclause = table(
        'files', column('id', sa.Integer), column('annotations', postgresql.JSONB)
    )

    results = conn.execution_options(stream_results=True).execute(
        sa.select([tableclause.c.id, tableclause.c.annotations]).where(
            tableclause.c.annotations != '[]'
        )
    )

    try:
        update_annotations(results, session, update_annotations_add_primary_name)
    except Exception:
        raise Exception('Migration failed.')


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
