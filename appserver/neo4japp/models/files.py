from sqlalchemy import and_, text
from sqlalchemy.dialects import postgresql
from sqlalchemy.types import TIMESTAMP

from neo4japp.database import db
from neo4japp.models.common import RDBMSBase, TimestampMixin, RecyclableMixin, FullTimestampMixin

file_collaborator_role = db.Table(
    'file_collaborator_role',
    db.Column('id', db.Integer, primary_key=True, autoincrement=True),
    db.Column('file_id', db.Integer(), db.ForeignKey('files.id'), nullable=False, index=True),
    db.Column('collaborator_id', db.Integer(), db.ForeignKey('appuser.id'), nullable=True, index=True),
    db.Column('collaborator_email', db.String(254), nullable=True, index=True),
    db.Column('role_id', db.Integer(), db.ForeignKey('app_role.id'), nullable=False, index=True),
    db.Column('owner_id', db.Integer(), db.ForeignKey('appuser.id'), nullable=False),
    db.Column('creation_date', db.TIMESTAMP(timezone=True), nullable=False, default=db.func.now()),
    db.Column('modified_date', db.TIMESTAMP(timezone=True), nullable=False, default=db.func.now(),
              onupdate=db.func.now()),
    db.Column('deletion_date', db.TIMESTAMP(timezone=True), nullable=True),
    db.Column('creator_id', db.Integer, db.ForeignKey('appuser.id'), nullable=True),
    db.Column('modifier_id', db.Integer, db.ForeignKey('appuser.id'), nullable=True),
    db.Column('deleter_id', db.Integer, db.ForeignKey('appuser.id'), nullable=True),
    db.Index('uq_file_collaborator_role',
             'file_id', 'collaborator_id', 'collaborator_email',
             'role_id', 'owner_id',
             unique=True,
             postgresql_where=text('deletion_date IS NULL')),
)


class FileContent(RDBMSBase):
    __tablename__ = 'files_content'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    raw_file = db.Column(db.LargeBinary, nullable=False)
    checksum_sha256 = db.Column(db.Binary(32), nullable=False, index=True, unique=True)
    creation_date = db.Column(db.DateTime, nullable=False, default=db.func.now())


class Files(RDBMSBase, FullTimestampMixin, RecyclableMixin):  # type: ignore
    __tablename__ = 'files'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    hash_id = db.Column(db.String(36), unique=True, nullable=False)
    filename = db.Column(db.String(200), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), index=True, nullable=False)
    project = db.relationship('Projects', foreign_keys=project_id)
    parent_id = db.Column(db.Integer, db.ForeignKey('files.id'), nullable=True, index=True)
    parent = db.relationship('Files', foreign_keys=parent_id)
    mime_type = db.Column(db.String(127), nullable=False)
    description = db.Column(db.String(2048), nullable=True)
    content_id = db.Column(db.Integer, db.ForeignKey('files_content.id', ondelete='CASCADE'),
                           index=True, nullable=True)
    content = db.relationship('FileContent', foreign_keys=content_id)
    user_id = db.Column(db.Integer, db.ForeignKey('appuser.id', ondelete='CASCADE'),
                        index=True, nullable=False)
    user = db.relationship('AppUser', foreign_keys=user_id)
    annotations = db.Column(postgresql.JSONB, nullable=True, server_default='[]')
    annotations_date = db.Column(TIMESTAMP(timezone=True), nullable=True)
    custom_annotations = db.Column(postgresql.JSONB, nullable=True, server_default='[]')
    doi = db.Column(db.String(1024), nullable=True)
    upload_url = db.Column(db.String(2048), nullable=True)
    excluded_annotations = db.Column(postgresql.JSONB, nullable=True, server_default='[]')
    public = db.Column(db.Boolean, nullable=False, default=False)
    deletion_date = db.Column(TIMESTAMP(timezone=True), nullable=True)
    recycling_date = db.Column(TIMESTAMP(timezone=True), nullable=True)
    __table_args__ = (
        db.Index('uq_files_unique_filename',
                 'project_id', 'filename', 'parent_id',
                 unique=True,
                 postgresql_where=and_(deletion_date.is_(None),
                                       recycling_date.is_(None))),
    )


class FileVersion(RDBMSBase, FullTimestampMixin):
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    file_id = db.Column(db.Integer, db.ForeignKey('files.id'),
                        index=True, nullable=False)
    file = db.relationship('Files', foreign_keys=file_id)
    message = db.Column(db.Text, nullable=True)
    content_id = db.Column(db.Integer, db.ForeignKey('files_content.id'),
                           index=True, nullable=False)
    content = db.relationship('FileContent', foreign_keys=content_id)
    user_id = db.Column(db.Integer, db.ForeignKey('appuser.id', ondelete='CASCADE'),
                        index=True, nullable=False)
    user = db.relationship('AppUser', foreign_keys=user_id)


class FileBackup(RDBMSBase, FullTimestampMixin):
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    file_id = db.Column(db.Integer, db.ForeignKey('files.id'),
                        index=True, nullable=False)
    file = db.relationship('Files', foreign_keys=file_id)
    raw_value = db.Column(db.LargeBinary, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('appuser.id', ondelete='CASCADE'),
                        index=True, nullable=False)
    user = db.relationship('AppUser', foreign_keys=user_id)


class LMDBsDates(RDBMSBase):
    __tablename__ = 'lmdbs_dates'
    name = db.Column(db.String(256), primary_key=True)
    date = db.Column(TIMESTAMP(timezone=True), nullable=False)


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
