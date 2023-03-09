"""Update user model to include first_name/last_name
and project to include author/public

Revision ID: e3afdf1adbd2
Revises: 6f6be267949c
Create Date: 2020-03-31 22:02:59.992221

"""
from alembic import context
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "e3afdf1adbd2"
down_revision = "6f6be267949c"
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column(
        "appuser", sa.Column("first_name", sa.String(length=120), nullable=True)
    )
    op.add_column(
        "appuser", sa.Column("last_name", sa.String(length=120), nullable=True)
    )
    op.add_column("project", sa.Column("author", sa.String(length=240), nullable=True))
    op.add_column("project", sa.Column("public", sa.Boolean(), nullable=True))
    # ### end Alembic commands ###
    if context.get_x_argument(as_dictionary=True).get("data_migrate", None):
        data_upgrades()


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column("project", "public")
    op.drop_column("project", "author")
    op.drop_column("appuser", "last_name")
    op.drop_column("appuser", "first_name")
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
