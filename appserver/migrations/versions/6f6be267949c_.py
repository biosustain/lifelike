"""Update file migrations schema and relation
with projects table through id instead of foreign key ... =(

Revision ID: 6f6be267949c
Revises: 59b6851c654e
Create Date: 2020-04-14 10:28:34.294973

"""
import sqlalchemy as sa
from alembic import context
from alembic import op

# revision identifiers, used by Alembic.
revision = "6f6be267949c"
down_revision = "59b6851c654e"
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column("files", sa.Column("project", sa.Integer(), nullable=False))
    op.alter_column(
        "files", "filename", existing_type=sa.VARCHAR(length=60), nullable=False
    )
    # ### end Alembic commands ###
    if context.get_x_argument(as_dictionary=True).get("data_migrate", None):
        data_upgrades()


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.alter_column(
        "files", "filename", existing_type=sa.VARCHAR(length=60), nullable=True
    )
    op.drop_column("files", "project")
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
