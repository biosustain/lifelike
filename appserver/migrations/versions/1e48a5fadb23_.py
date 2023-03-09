"""Make sure the annotating configs are correct for files

Revision ID: 1e48a5fadb23
Revises: c4a037faaf1a
Create Date: 2021-12-16 15:38:16.500102

"""
import sqlalchemy as sa

# flake8: noqa: OIG001 # It is legacy file with imports from appserver which we decided to not fix
from alembic import context
from alembic import op
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm.session import Session
from sqlalchemy.sql import table, column

from migrations.utils import window_chunk
from neo4japp.constants import FILE_MIME_TYPE_ENRICHMENT_TABLE, FILE_MIME_TYPE_PDF
from neo4japp.models import Files
from neo4japp.services.annotations.constants import DEFAULT_ANNOTATION_CONFIGS

# revision identifiers, used by Alembic.
revision = "1e48a5fadb23"
down_revision = "c4a037faaf1a"
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    # ### end Alembic commands ###
    if context.get_x_argument(as_dictionary=True).get("data_migrate", None):
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

    tableclause1 = table(
        "files",
        column("id", sa.Integer),
        column("mime_type", sa.String),
        column("annotation_configs", postgresql.JSONB),
    )

    files = conn.execution_options(stream_results=True).execute(
        sa.select(
            [
                tableclause1.c.id.label("file_id"),
                tableclause1.c.annotation_configs.label("annotation_configs"),
            ]
        ).where(
            tableclause1.c.mime_type.in_(
                [FILE_MIME_TYPE_ENRICHMENT_TABLE, FILE_MIME_TYPE_PDF]
            )
        )
    )

    for chunk in window_chunk(files, 25):
        files_to_update = []
        for fid, configs in chunk:
            if configs and "annotation_methods" not in configs:
                files_to_update.append(
                    {"id": fid, "annotation_configs": DEFAULT_ANNOTATION_CONFIGS}
                )

        try:
            session.bulk_update_mappings(Files, files_to_update)
            session.commit()
        except Exception:
            raise


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
