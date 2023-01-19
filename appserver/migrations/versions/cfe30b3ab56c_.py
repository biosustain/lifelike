"""Update all file paths to correct values

Revision ID: cfe30b3ab56c
Revises: 55d9a626454f
Create Date: 2022-09-26 19:43:01.495090

"""
from alembic import context, op
from sqlalchemy import Integer, Column, LargeBinary, String, select
from sqlalchemy.orm import Session

from migrations.utils import window_chunk

# revision identifiers, used by Alembic.
revision = 'cfe30b3ab56c'
down_revision = '55d9a626454f'
branch_labels = None
depends_on = None

from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()


class Files(Base):
    __tablename__ = 'files'
    id = Column(Integer, primary_key=True, autoincrement=True)
    mime_type = Column(String(127), nullable=False)


class FileContent(Base):
    __tablename__ = 'files_content'
    id = Column(Integer, primary_key=True, autoincrement=True)
    raw_file = Column(LargeBinary, nullable=False)


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
    session = Session(conn)

    entities = conn.execution_options(stream_results=True).execute(
        select([
            Files.id,
            FileContent.id,
            FileContent.raw_file
        ])
    )

    for chunk in window_chunk(entities, 25):
        try:
            session.bulk_update_mappings(
                FileContent,
                [{
                    'id': chunk['files_content_id'],
                    'raw_file': ''
                }]
            )
            session.commit()
        except Exception:
            raise


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
