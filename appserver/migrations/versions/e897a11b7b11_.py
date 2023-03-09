"""Renamed files_content.file_id to files_content.file_content_id, and
added new files_content.file_id

Revision ID: e897a11b7b11
Revises: 3c50ed01b05c
Create Date: 2021-06-29 19:57:47.220379

"""
import sqlalchemy as sa
from alembic import context
from alembic import op

# revision identifiers, used by Alembic.
revision = "e897a11b7b11"
down_revision = "3c50ed01b05c"
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index(op.f("ix_global_list_file_id"), table_name="global_list")
    op.alter_column("global_list", "file_id", new_column_name="file_content_id")
    op.create_index(
        op.f("ix_global_list_file_content_id"),
        "global_list",
        ["file_content_id"],
        unique=False,
    )

    op.add_column("global_list", sa.Column("file_id", sa.Integer(), nullable=True))
    op.create_index(
        op.f("ix_global_list_file_id"), "global_list", ["file_id"], unique=False
    )
    op.create_foreign_key(
        op.f("fk_global_list_file_id_files"),
        "global_list",
        "files",
        ["file_id"],
        ["id"],
    )
    # ### end Alembic commands ###
    if context.get_x_argument(as_dictionary=True).get("data_migrate", None):
        data_upgrades()


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_constraint(
        "fk_global_list_file_id_files", "global_list", type_="foreignkey"
    )
    op.drop_index(op.f("ix_global_list_file_id"), table_name="global_list")
    op.drop_column("global_list", "file_id")
    op.drop_index(op.f("ix_global_list_file_content_id"), table_name="global_list")
    op.alter_column("global_list", "file_content_id", new_column_name="file_id")
    op.create_index(
        op.f("ix_global_list_file_id"), "global_list", ["file_id"], unique=False
    )
    op.create_foreign_key(
        op.f("fk_global_list_file_id_files"),
        "global_list",
        "files",
        ["file_id"],
        ["id"],
    )
    # ### end Alembic commands ###
    # NOTE: In practice perfect downgrades are difficult and in some cases
    # impossible! It is more practical to use database backups/snapshots to
    # "downgrade" the database. Changes to the database that we intend to
    # push to production should always be added to a NEW migration.
    # (i.e. "downgrade forward"!)


def data_upgrades():
    """Add optional data upgrade migrations here"""
    # TODO: update this once data is gathered about how to fix
    # existing global inclusions as they do not have ref to a file
    pass


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
