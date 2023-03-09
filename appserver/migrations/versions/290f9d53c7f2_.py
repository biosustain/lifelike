"""Drop irrelevant columns

Revision ID: 290f9d53c7f2
Revises: b7cf64e5ba7c
Create Date: 2020-09-14 16:04:48.974382

"""
import sqlalchemy as sa
from alembic import context
from alembic import op

# revision identifiers, used by Alembic.
revision = "290f9d53c7f2"
down_revision = "b7cf64e5ba7c"
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index("ix_project_version_search_vector", table_name="project_version")
    op.drop_constraint("uq_project_version_hash_id", "project_version", type_="unique")
    op.drop_column("project_version", "hash_id")
    # ### end Alembic commands ###
    if context.get_x_argument(as_dictionary=True).get("data_migrate", None):
        data_upgrades()


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column(
        "project_version",
        sa.Column("hash_id", sa.VARCHAR(length=50), autoincrement=False, nullable=True),
    )
    op.create_unique_constraint(
        "uq_project_version_hash_id", "project_version", ["hash_id"]
    )
    op.create_index(
        "ix_project_version_search_vector",
        "project_version",
        ["search_vector"],
        unique=False,
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
