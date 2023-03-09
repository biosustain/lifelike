"""Add sample project

Revision ID: ad97ec0e4973
Revises: 5f165b2231f9
Create Date: 2023-02-09 20:59:14.824234

"""
import enum
import fastjsonschema
import json
import os
import uuid

from alembic import context, op
from datetime import timezone
from flask_sqlalchemy import SQLAlchemy
from pathlib import Path
from sqlalchemy import (
    Boolean,
    Column,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    func,
    select,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.engine import Connection
from sqlalchemy.types import TIMESTAMP

from migrations.constants import LIFELIKE_SUPERUSER

# revision identifiers, used by Alembic.
revision = "ad97ec0e4973"
down_revision = "5f165b2231f9"
branch_labels = None
depends_on = None

db = SQLAlchemy()

FILE_MIME_TYPE_DIRECTORY = "vnd.***ARANGO_DB_NAME***.filesystem/directory"
MASTER_PROJECT_NAME = "master-initial-project"
MASTER_PROJECT_FOLDER_PATH = f"/{MASTER_PROJECT_NAME}"
TIMEZONE = timezone.utc


# copied from /models/files.py
class AnnotationChangeCause(enum.Enum):
    USER = "user"
    USER_REANNOTATION = "user_reannotation"
    SYSTEM_REANNOTATION = "sys_reannotation"


t_files = Table(
    "files",
    MetaData(),
    Column("id", Integer, primary_key=True),
    Column("hash_id", String),
    Column("filename", String),
    Column("parent_id", Integer),
    Column("mime_type", String),
    Column("content_id", Integer),
    Column("user_id", Integer),
    Column("public", Boolean, default=False),
    Column("pinned", Boolean, default=False),
    Column("description", String),
    Column("creation_date", TIMESTAMP(timezone=True), default=func.now()),
    Column("modified_date", TIMESTAMP(timezone=True), default=func.now()),
    Column("path", Text),
    Column("annotations", JSONB),
    Column("annotations_date", TIMESTAMP(timezone=True), default=func.now()),
    Column("enrichment_annotations", JSONB),
    Column("annotation_configs", JSONB),
    Column("organism_name", String),
    Column("organism_synonym", String),
    Column("organism_taxonomy_id", String),
)

t_projects = Table(
    "projects",
    MetaData(),
    Column("id", Integer, primary_key=True),
    Column("hash_id", String),
    Column("name", String),
    Column("description", Text),
    Column("***ARANGO_USERNAME***_id", Integer),
    Column("creation_date", TIMESTAMP(timezone=True), default=func.now()),
    Column("modified_date", TIMESTAMP(timezone=True), default=func.now()),
)

t_projects_collaborator_role = Table(
    "projects_collaborator_role",
    MetaData(),
    Column("appuser_id", Integer),
    Column("app_role_id", Integer),
    Column("projects_id", Integer),
)

t_app_role = Table(
    "app_role",
    MetaData(),
    Column("id", Integer, primary_key=True),
    Column("name", String),
)

t_appuser = Table(
    "appuser",
    MetaData(),
    Column("id", Integer, primary_key=True),
    Column("hash_id", String),
    Column("username", String),
    Column("email", String),
    Column("first_name", String),
    Column("last_name", String),
    Column("password_hash", String),
    Column("failed_login_count", Integer, default=0),
    Column("forced_password_reset", Boolean),
    Column("subject", String),
    Column("creation_date", TIMESTAMP(timezone=True), default=func.now()),
    Column("modified_date", TIMESTAMP(timezone=True), default=func.now()),
)

t_appuser_role = Table(
    "app_user_role",
    MetaData(),
    Column("appuser_id", Integer),
    Column("app_role_id", Integer),
)


def upgrade():
    if context.get_x_argument(as_dictionary=True).get("data_migrate", None):
        data_upgrades()


def downgrade():
    pass
    # NOTE: In practice perfect downgrades are difficult and in some cases
    # impossible! It is more practical to use database backups/snapshots to
    # "downgrade" the database. Changes to the database that we intend to
    # push to production should always be added to a NEW migration.
    # (i.e. "downgrade forward"!)


def _get_superuser_id(conxn: Connection):
    # Get superuser id
    return conxn.execute(
        select(
            [
                t_appuser.c.id,
            ]
        ).where(t_appuser.c.email == LIFELIKE_SUPERUSER)
    ).scalar()


def _create_***ARANGO_USERNAME***_file_for_master_project(conxn: Connection, superuser_id: int) -> int:
    # Create ***ARANGO_USERNAME*** file
    return conxn.execute(
        t_files.insert().values(
            hash_id=str(uuid.uuid4()),
            filename="/",
            mime_type=FILE_MIME_TYPE_DIRECTORY,
            user_id=superuser_id,
            path=MASTER_PROJECT_FOLDER_PATH,
        )
    ).inserted_primary_key[0]


def _create_master_project(conxn: Connection, master_folder_id: int) -> int:
    return conxn.execute(
        t_projects.insert().values(
            hash_id=str(uuid.uuid4()),
            name=MASTER_PROJECT_NAME,
            description="Master copy of the initial user project.",
            ***ARANGO_USERNAME***_id=master_folder_id,
        )
    ).inserted_primary_key[0]


def _add_all_admins_to_master_project(conxn: Connection, master_project_id: int):
    admin_role_id = conxn.execute(
        select(
            [
                t_app_role.c.id,
            ]
        ).where(t_app_role.c.name == "admin")
    ).scalar()

    admin_ids = conxn.execute(
        select(
            [
                t_appuser_role.c.appuser_id,
            ]
        ).where(t_appuser_role.c.app_role_id == admin_role_id)
    ).fetchall()

    # Add each admin as a 'project-admin' for the master project

    project_admin_role_id = conxn.execute(
        select(
            [
                t_app_role.c.id,
            ]
        ).where(t_app_role.c.name == "project-admin")
    ).scalar()

    for (admin,) in admin_ids:
        conxn.execute(
            t_projects_collaborator_role.insert().values(
                appuser_id=admin,
                app_role_id=project_admin_role_id,
                projects_id=master_project_id,
            )
        )


def _add_superuser_as_project_owner(conxn, superuser_id: int, master_project: int):
    project_read_and_write = conxn.execute(
        select(
            [
                t_app_role.c.id,
            ]
        ).where(t_app_role.c.name.in_(["project-write", "project-read"]))
    ).fetchall()

    for (role,) in project_read_and_write:
        conxn.execute(
            t_projects_collaborator_role.insert().values(
                appuser_id=superuser_id,
                app_role_id=role,
                projects_id=master_project,
            )
        )


def data_upgrades():
    """Add optional data upgrade migrations here"""
    conxn = op.get_bind()

    superuser_id = _get_superuser_id(conxn)
    master_initial_folder_id = _create_***ARANGO_USERNAME***_file_for_master_project(conxn, superuser_id)
    master_initial_project_id = _create_master_project(conxn, master_initial_folder_id)
    _add_superuser_as_project_owner(conxn, superuser_id, master_initial_project_id)
    _add_all_admins_to_master_project(conxn, master_initial_project_id)


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
