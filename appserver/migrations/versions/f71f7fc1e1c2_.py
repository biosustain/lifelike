"""Add table project_backup

Revision ID: f71f7fc1e1c2
Revises: b6b9fb435404
Create Date: 2020-06-24 20:12:44.419474

"""
import sqlalchemy as sa
from alembic import context
from alembic import op

# revision identifiers, used by Alembic.
revision = "f71f7fc1e1c2"
down_revision = "b6b9fb435404"
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table(
        "project_backup",
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=250), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("date_modified", sa.DateTime(), nullable=True),
        sa.Column("graph", sa.JSON(), nullable=True),
        sa.Column("author", sa.String(length=240), nullable=False),
        sa.Column("public", sa.Boolean(), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("hash_id", sa.String(length=50), nullable=True),
        sa.PrimaryKeyConstraint("project_id", name=op.f("pk_project_backup")),
    )
    # ### end Alembic commands ###
    if context.get_x_argument(as_dictionary=True).get("data_migrate", None):
        data_upgrades()


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table("project_backup")
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
