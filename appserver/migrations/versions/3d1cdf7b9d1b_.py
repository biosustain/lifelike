"""Add superuser if one does not exist

Revision ID: 3d1cdf7b9d1b
Revises: 647dad6e2adf
Create Date: 2023-02-09 23:40:44.192896

"""
from alembic import context
from alembic import op
from sqlalchemy import (
    select,
    Boolean,
    Column,
    Integer,
    MetaData,
    String,
    Table,
)
import uuid

# revision identifiers, used by Alembic.
revision = '3d1cdf7b9d1b'
down_revision = '647dad6e2adf'
branch_labels = None
depends_on = None

t_app_role = Table(
    'app_role',
    MetaData(),
    Column('id', Integer, primary_key=True),
    Column('name', String)
)

t_appuser = Table(
    'appuser',
    MetaData(),
    Column('id', Integer, primary_key=True),
    Column('hash_id', String),
    Column('username', String),
    Column('email', String),
    Column('first_name', String),
    Column('last_name', String),
    Column('password_hash', String),
    Column('failed_login_count', Integer),
    Column('forced_password_reset', Boolean),
    Column('subject', String),
)

t_appuser_role = Table(
    'app_user_role',
    MetaData(),
    Column('appuser_id', Integer),
    Column('app_role_id', Integer)
)


def upgrade():
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
    conn = op.get_bind()

    existing_superuser = conn.execute(select([
        t_appuser.c.id,
    ]).where(
        t_appuser.c.email == 'superuser@***ARANGO_DB_NAME***.bio'
    )).scalar()

    if existing_superuser is None:
        # Add ***ARANGO_USERNAME*** project system user
        new_superuser_id = conn.execute(
            t_appuser.insert().values(
                hash_id=str(uuid.uuid4()),
                username='superuser',
                email='superuser@***ARANGO_DB_NAME***.bio',
                first_name='super',
                last_name='user',
                password_hash=b'$2b$12$XiwYHvQb/M0a1Z0iNxpOYehL4is8DOvITsgw537oD83hZZop/Z502'.decode('utf8'),
                failed_login_count=0,
                forced_password_reset=False,
                subject='superuser@***ARANGO_DB_NAME***.bio'
            )
        ).inserted_primary_key[0]

        superuser_role_ids = conn.execute(
            select([
                t_app_role.c.id,
            ]).where(
                t_app_role.c.name.in_(['private-data-access', 'admin', 'user']
            ))
        ).fetchall()

        for role_id, in superuser_role_ids:
            conn.execute(
                t_appuser_role.insert().values(
                    appuser_id=new_superuser_id,
                    app_role_id=role_id
                )
            )


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass