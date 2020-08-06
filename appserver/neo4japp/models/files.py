from datetime import datetime, timezone

from sqlalchemy.dialects import postgresql
from sqlalchemy.orm.query import Query
from sqlalchemy.types import TIMESTAMP

from neo4japp.database import db
from neo4japp.models.common import RDBMSBase
from neo4japp.models.drawing_tool import Project


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
    description = db.Column(db.String(2048), nullable=True)
    content_id = db.Column(db.Integer,
                           db.ForeignKey('files_content.id', ondelete='CASCADE'),
                           nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('appuser.id', ondelete='CASCADE'), nullable=False)
    creation_date = db.Column(db.DateTime, default=db.func.now())
    annotations = db.Column(postgresql.JSONB, nullable=True, server_default='[]')
    annotations_date = db.Column(TIMESTAMP(timezone=True), nullable=True)
    project = db.Column(db.Integer(), db.ForeignKey('projects.id'), nullable=False)
    custom_annotations = db.Column(postgresql.JSONB, nullable=True, server_default='[]')
    dir_id = db.Column(db.Integer, db.ForeignKey('directory.id'), nullable=False)
    doi = db.Column(db.String(1024), nullable=True)
    upload_url = db.Column(db.String(2048), nullable=True)
    excluded_annotations = db.Column(postgresql.JSONB, nullable=True, server_default='[]')


class LMDBsDates(RDBMSBase):
    __tablename__ = 'lmdbs_dates'
    name = db.Column(db.String(256), primary_key=True)
    date = db.Column(TIMESTAMP(timezone=True), nullable=False)


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
    project = db.relationship('Project')
    user_id = db.Column(db.Integer, db.ForeignKey('appuser.id'), nullable=True)

    @classmethod
    def query_child_directories(cls, dir_id: int) -> Query:
        base_query = db.session.query(cls).filter(cls.id == dir_id).cte(recursive=True)
        query = base_query.union_all(
            db.session.query(cls).join(
                base_query,
                base_query.c.id == cls.directory_parent_id
            )
        )
        return query

    @classmethod
    def query_absolute_dir_path(cls, dir_id: int) -> Query:
        base_query = db.session.query(cls).filter(cls.id == dir_id).cte(recursive=True)
        query = base_query.union_all(
            db.session.query(cls).join(
                base_query,
                base_query.c.directory_parent_id == Directory.id
            )
        )
        return query


# TODO: Adding the _bare minimum_ columns to this table for now. I imagine that eventually
# we will want to manage permissions on worksheets, just as we do for pdf files. However,
# we also don't currently have a home in the UI for managing these worksheets.
class Worksheet(RDBMSBase):  # type: ignore
    __tablename__ = 'worksheets'
    id = db.Column(db.Integer(), primary_key=True, autoincrement=True)
    filename = db.Column(db.String(200), nullable=False)
    sheetname = db.Column(db.String(200), nullable=False)
    neo4j_node_id = db.Column(db.Integer, nullable=False)
    creation_date = db.Column(db.DateTime, default=db.func.now())
    content_id = db.Column(db.Integer,
                           db.ForeignKey('files_content.id', ondelete='CASCADE'),
                           nullable=False)
