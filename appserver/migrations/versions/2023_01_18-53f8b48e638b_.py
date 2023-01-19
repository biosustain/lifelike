"""empty message

Revision ID: 53f8b48e638b
Revises: 647dad6e2adf
Create Date: 2023-01-18 14:50:51.501130

"""

from alembic import context
from alembic import op
from sqlalchemy import Column, Integer, String, LargeBinary, select, update
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session

from migrations.utils import window_chunk

# revision identifiers, used by Alembic.
revision = '53f8b48e638b'
down_revision = '647dad6e2adf'
branch_labels = None
depends_on = None


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
    return


def data_upgrades():
    """Add optional data upgrade migrations here"""
    session = Session(op.get_bind())

    files_content = session.execute(
        select([
            FileContent.id,
            FileContent.raw_file,
        ])
    )

    for chunk in window_chunk(files_content, 25):
        for file_content_id, files_content_raw_file in chunk:
            session.execute(
                update(FileContent)
                    .where(FileContent.id == file_content_id)
                    .values(raw_file=files_content_raw_file)
            )
        session.flush()
    session.commit()


def data_downgrades():
    """Add optional data downgrade migrations here"""
    return
