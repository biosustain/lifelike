from enum import Enum

from sqlalchemy.dialects import postgresql

from neo4japp.database import db
from neo4japp.models.common import RDBMSBase


class InclusionExclusionType(Enum):
    INCLUSION = 'inclusion'
    EXCLUSION = 'exclusion'


class GlobalList(RDBMSBase):
    __tablename__ = 'global_list'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    annotation = db.Column(postgresql.JSON, nullable=False)
    type = db.Column(db.String(12), nullable=False)
    file_id = db.Column(db.Integer, db.ForeignKey('files_content.id'), nullable=False, index=True)
    reviewed = db.Column(db.Boolean, default=False)
    approved = db.Column(db.Boolean, default=False)
    creation_date = db.Column(db.DateTime, default=db.func.now())
    modified_date = db.Column(db.DateTime)


class AnnotationStopWords(RDBMSBase):
    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    word = db.Column(db.String(80), nullable=False)
