"""Fix old annotated papers to have default annotation configs.

Revision ID: 20a288c39ff2
Revises: 9ab4ceb163b3
Create Date: 2021-03-15 16:37:31.276178

"""
from alembic import context
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column, text, null
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm.session import Session

from migrations.utils import window_chunk

# flake8: noqa: OIG001 # It is legacy file with imports from appserver which we decided to not fix
from neo4japp.models import Files
from neo4japp.models.files import FileAnnotationsVersion

from neo4japp.services.annotations.constants import DEFAULT_ANNOTATION_CONFIGS

# revision identifiers, used by Alembic.
revision = '20a288c39ff2'
down_revision = '9ab4ceb163b3'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    # ### end Alembic commands ###
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    # ### end Alembic commands ###
    pass
    # NOTE: In practice perfect downgrades are difficult and in some cases
    # impossible! It is more practical to use database backups/snapshots to
    # "downgrade" the database. Changes to the database that we intend to
    # push to production should always be added to a NEW migration.
    # (i.e. "downgrade forward"!)


def data_upgrades():
    """Add optional data upgrade migrations here"""
    conn = op.get_bind()
    session = Session(conn)

    tableclause = table(
        'files',
        column('id', sa.Integer),
        column('annotations', postgresql.JSONB),
        column('mime_type', sa.String),
        column('annotation_configs', sa.String),
    )

    # fix annotations, set to proper null value for files with no annotations
    files = conn.execution_options(stream_results=True).execute(
        sa.select([tableclause.c.id, tableclause.c.annotations]).where(
            sa.and_(
                sa.or_(
                    tableclause.c.mime_type == 'application/pdf',
                    tableclause.c.mime_type == 'vnd.lifelike.document/enrichment-table',
                ),
                tableclause.c.annotations == 'null',
            )
        )
    )

    for chunk in window_chunk(files, 25):
        collected = []
        for fid, annotations in chunk:
            collected.append({'id': fid, 'annotations': '[]'})
        try:
            session.bulk_update_mappings(Files, collected)
            session.commit()
        except Exception:
            session.rollback()
            raise

    # update files that do not have annotation_configs to default
    files = conn.execution_options(stream_results=True).execute(
        sa.select([tableclause.c.id, tableclause.c.annotations]).where(
            sa.and_(
                sa.or_(
                    tableclause.c.mime_type == 'application/pdf',
                    tableclause.c.mime_type == 'vnd.lifelike.document/enrichment-table',
                ),
                tableclause.c.annotation_configs.is_(None),
            )
        )
    )

    for chunk in window_chunk(files, 25):
        collected = []
        for fid, file_annotations in chunk:
            collected.append(
                {'id': fid, 'annotation_configs': DEFAULT_ANNOTATION_CONFIGS}
            )
        try:
            session.bulk_update_mappings(Files, collected)
            session.commit()
        except Exception:
            session.rollback()
            raise


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
