from datetime import datetime, timezone

from sqlalchemy import event
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm.query import Query
from sqlalchemy.types import ARRAY, TIMESTAMP

from neo4japp.constants import FILE_INDEX_ID
from neo4japp.database import db, get_elastic_service
from neo4japp.models.common import RDBMSBase, TimestampMixin


class FileContent(RDBMSBase):
    __tablename__ = 'files_content'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    raw_file = db.Column(db.LargeBinary, nullable=False)
    checksum_sha256 = db.Column(db.Binary(32), nullable=False, index=True, unique=True)
    creation_date = db.Column(db.DateTime, nullable=False, default=db.func.now())
    # parsed_content = db.Column(postgresql.JSONB, nullable=True)


class Files(RDBMSBase, TimestampMixin):  # type: ignore
    __tablename__ = 'files'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    file_id = db.Column(db.String(36), unique=True, nullable=False)
    filename = db.Column(db.String(200), nullable=False)
    description = db.Column(db.String(2048), nullable=True)
    content_id = db.Column(db.Integer,
                           db.ForeignKey('files_content.id', ondelete='CASCADE'),
                           index=True,
                           nullable=False)
    content = db.relationship('FileContent', foreign_keys=content_id)
    user_id = db.Column(db.Integer,
                        db.ForeignKey('appuser.id', ondelete='CASCADE'),
                        index=True,
                        nullable=False)
    user = db.relationship('AppUser', foreign_keys=user_id)
    annotations = db.Column(postgresql.JSONB, nullable=True, server_default='[]')
    annotations_date = db.Column(TIMESTAMP(timezone=True), nullable=True)
    project = db.Column(db.Integer(), db.ForeignKey('projects.id'), index=True, nullable=False)
    project_ = db.relationship('Projects', foreign_keys=project)
    custom_annotations = db.Column(postgresql.JSONB, nullable=True, server_default='[]')
    dir_id = db.Column(db.Integer, db.ForeignKey('directory.id'), index=True, nullable=False)
    dir = db.relationship('Directory', foreign_keys=dir_id)
    doi = db.Column(db.String(1024), nullable=True)
    upload_url = db.Column(db.String(2048), nullable=True)
    excluded_annotations = db.Column(postgresql.JSONB, nullable=True, server_default='[]')
    fallback_organism_id = db.Column(
        db.Integer,
        # CAREFUL do not allow cascade ondelete
        # fallback organism can be deleted
        db.ForeignKey('fallback_organism.id'),
        index=True,
        nullable=True,
    )
    fallback_organism = db.relationship('FallbackOrganism', foreign_keys=fallback_organism_id)


# Files table ORM event listeners
@event.listens_for(Files, 'after_insert')
def files_after_insert(mapper, connection, target):
    "listen for the 'after_insert' event"

    # Add this file as an elasticsearch document
    elastic_service = get_elastic_service()
    elastic_service.index_files([target.id])


@event.listens_for(Files, 'after_delete')
def files_after_delete(mapper, connection, target):
    "listen for the 'after_delete' event"

    # Delete this file from elasticsearch
    elastic_service = get_elastic_service()
    elastic_service.delete_documents_with_index(
        file_ids=[target.file_id],
        index_id=FILE_INDEX_ID
    )


@event.listens_for(Files, 'after_update')
def files_after_update(mapper, connection, target):
    "listen for the 'after_update' event"

    # Update the elasticsearch document for this file
    elastic_service = get_elastic_service()
    elastic_service.delete_documents_with_index(
        file_ids=[target.file_id],
        index_id=FILE_INDEX_ID
    )
    elastic_service.index_files([target.id])


class LMDBsDates(RDBMSBase):
    __tablename__ = 'lmdbs_dates'
    name = db.Column(db.String(256), primary_key=True)
    date = db.Column(TIMESTAMP(timezone=True), nullable=False)


class FallbackOrganism(RDBMSBase):
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    organism_name = db.Column(db.String(200), nullable=False)
    organism_synonym = db.Column(db.String(200), nullable=False)
    organism_taxonomy_id = db.Column(db.String(50), nullable=False)


class Directory(RDBMSBase, TimestampMixin):
    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    name = db.Column(db.String(200), nullable=False)
    directory_parent_id = db.Column(
        db.BigInteger,
        db.ForeignKey('directory.id'),
        index=True,
        nullable=True,  # original parent is null
    )
    projects_id = db.Column(
        db.Integer,
        db.ForeignKey('projects.id'),
        index=True,
        nullable=False,
    )
    files = db.relationship('Files')
    project = db.relationship('Projects', foreign_keys=projects_id)
    user_id = db.Column(db.Integer, db.ForeignKey('appuser.id'), index=True, nullable=True)
    user = db.relationship('AppUser', foreign_keys=user_id)

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
class Worksheet(RDBMSBase, TimestampMixin):  # type: ignore
    __tablename__ = 'worksheets'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    filename = db.Column(db.String(200), nullable=False)
    sheetname = db.Column(db.String(200), nullable=False)
    neo4j_node_id = db.Column(db.Integer, nullable=False)
    content_id = db.Column(db.Integer,
                           db.ForeignKey('files_content.id', ondelete='CASCADE'),
                           index=True,
                           nullable=False)
