from sqlalchemy.dialects import postgresql

from neo4japp.database import db
from neo4japp.models import AppUser
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
    filename = db.Column(db.String(200), nullable=False)
    content_id = db.Column(db.Integer,
                           db.ForeignKey('files_content.id', ondelete='CASCADE'),
                           nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('appuser.id', ondelete='CASCADE'), nullable=False)
    creation_date = db.Column(db.DateTime, default=db.func.now())
    annotations = db.Column(postgresql.JSONB, nullable=False, server_default='[]')
    project = db.Column(db.Integer(), db.ForeignKey('projects.id'), nullable=False)
    custom_annotations = db.Column(postgresql.JSONB, nullable=False, server_default='[]')
    dir_id = db.Column(db.Integer, db.ForeignKey('directory.id'), nullable=False)


class Directory(RDBMSBase):
    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    name = db.Column(db.String(200), nullable=False)
    directory_parent_id = db.Column(
        db.BigInteger,
        db.ForeignKey('directory.id'),
        nullable=True,  # original parent is null
    )
    projects_id = db.Column(
        db.Integer,
        db.ForeignKey('projects.id'),
        nullable=False,
    )
    files = db.relationship('Files')
