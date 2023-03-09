"""Make user's name and project's author non-nullable

Revision ID: 384e13b3ec54
Revises: e3afdf1adbd2
Create Date: 2020-04-08 19:11:26.626906

"""
import sqlalchemy as sa
from alembic import context
from alembic import op

# revision identifiers, used by Alembic.
revision = "384e13b3ec54"
down_revision = "e3afdf1adbd2"
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.alter_column(
        "appuser", "first_name", existing_type=sa.VARCHAR(length=120), nullable=False
    )
    op.alter_column(
        "appuser", "last_name", existing_type=sa.VARCHAR(length=120), nullable=False
    )
    op.alter_column(
        "project", "author", existing_type=sa.VARCHAR(length=240), nullable=False
    )
    # ### end Alembic commands ###
    if context.get_x_argument(as_dictionary=True).get("data_migrate", None):
        data_upgrades()


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.alter_column(
        "project", "author", existing_type=sa.VARCHAR(length=240), nullable=True
    )
    op.alter_column(
        "appuser", "last_name", existing_type=sa.VARCHAR(length=120), nullable=True
    )
    op.alter_column(
        "appuser", "first_name", existing_type=sa.VARCHAR(length=120), nullable=True
    )
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
