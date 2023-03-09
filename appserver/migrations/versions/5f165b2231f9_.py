"""Add (potentially) missing app roles

Revision ID: 5f165b2231f9
Revises: 3d1cdf7b9d1b
Create Date: 2023-02-28 21:36:15.927801

"""
from alembic import context, op
from sqlalchemy import Column, Integer, MetaData, String, Table, select


# revision identifiers, used by Alembic.
revision = "5f165b2231f9"
down_revision = "3d1cdf7b9d1b"
branch_labels = None
depends_on = None


t_app_role = Table(
    "app_role",
    MetaData(),
    Column("id", Integer, primary_key=True),
    Column("name", String),
)


def upgrade():
    pass
    if context.get_x_argument(as_dictionary=True).get("data_migrate", None):
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
    conxn = op.get_bind()

    potentially_missing_roles = [
        "admin",
        "project-read",
        "project-write",
        "project-admin",
    ]

    for role in potentially_missing_roles:
        check_role = conxn.execute(
            select(
                [
                    t_app_role.c.id,
                ]
            ).where(t_app_role.c.name == role)
        ).fetchone()

        if check_role is None:
            conxn.execute(t_app_role.insert().values(name=role))


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
