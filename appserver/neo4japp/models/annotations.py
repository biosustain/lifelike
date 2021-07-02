from enum import Enum

from sqlalchemy.dialects import postgresql

from neo4japp.database import db
from neo4japp.models.common import RDBMSBase, TimestampMixin


class GlobalList(RDBMSBase, TimestampMixin):
    __tablename__ = 'global_list'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    annotation = db.Column(postgresql.JSON, nullable=False)
    type = db.Column(db.String(12), nullable=False)
    file_content_id = db.Column(db.Integer, db.ForeignKey('files_content.id'), nullable=False, index=True)  # noqa
    # nullable to work with existing data because due to previous bad migration,
    # we're not going to migrate values into this new column
    file_id = db.Column(db.Integer, db.ForeignKey('files.id'), nullable=True, index=True)
    reviewed = db.Column(db.Boolean, default=False)
    approved = db.Column(db.Boolean, default=False)


class AnnotationStopWords(RDBMSBase):
    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    word = db.Column(db.String(80), nullable=False)
