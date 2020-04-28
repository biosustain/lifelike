from sqlalchemy.dialects import postgresql

from neo4japp.database import db
from neo4japp.models.common import RDBMSBase


class FileContent(RDBMSBase):
    __tablename__ = 'files_content'
    id = db.Column(db.Integer(), primary_key=True, autoincrement=True)
    raw_file = db.Column(db.LargeBinary, nullable=False)
    checksum_sha256 = db.Column(db.Binary(32), nullable=False, index=True, unique=True)
    creation_date = db.Column(db.DateTime, nullable=False, default=db.func.now())


class Files(RDBMSBase):  # type: ignore
    __tablename__ = 'files'
    id = db.Column(db.Integer(), primary_key=True, autoincrement=True)
    file_id = db.Column(db.String(36), unique=True, nullable=False)
    filename = db.Column(db.String(60), nullable=False)
    content_id = db.Column(db.Integer, db.ForeignKey('files_content.id', ondelete='CASCADE'))
    raw_file = db.Column(db.LargeBinary, nullable=True)
    username = db.Column(db.String(30))
    creation_date = db.Column(db.DateTime, default=db.func.now())
    annotations = db.Column(postgresql.JSONB, nullable=False, server_default='[]')
    project = db.Column(db.Integer(), db.ForeignKey('projects.id'), nullable=False)
    custom_annotations = db.Column(postgresql.JSONB, nullable=False, server_default='[]')
