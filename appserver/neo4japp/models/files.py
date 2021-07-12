import enum
import hashlib
import os
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import BinaryIO, Optional, List, Dict

import sqlalchemy
from sqlalchemy import and_, text, event, orm
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm.exc import NoResultFound
from sqlalchemy.orm.query import Query
from sqlalchemy.types import ARRAY, TIMESTAMP

from neo4japp.constants import FILE_INDEX_ID
from neo4japp.database import db, get_elastic_service
from neo4japp.models import Projects
from neo4japp.models.common import RDBMSBase, TimestampMixin, RecyclableMixin, FullTimestampMixin, \
    HashIdMixin

file_collaborator_role = db.Table(
    'file_collaborator_role',
    db.Column('id', db.Integer, primary_key=True, autoincrement=True),
    db.Column('file_id', db.Integer(), db.ForeignKey('files.id'), nullable=False, index=True),
    db.Column('collaborator_id', db.Integer(), db.ForeignKey('appuser.id'), nullable=True,
              index=True),
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

    @property
    def raw_file_utf8(self):
        return self.raw_file.decode('utf-8')

    @raw_file_utf8.setter
    def raw_file_utf8(self, value):
        self.raw_file = value.encode('utf-8')
        self.checksum_sha256 = hashlib.sha256(self.raw_file).digest()

    @classmethod
    def get_file_lock_hash(cls, checksum_sha256: bytes) -> int:
        """Create the hash for the pg_advisory_xact_lock() function to prevent
        a race condition on inserting rows to FileContent.
        """

        # We use SHAKE-128 (a.k.a. Keccak or SHA-3) to generate a
        # signed BIGINT for pg_advisory_xact_lock() to maximize the
        # bit space accepted by the function
        h = hashlib \
            .shake_128('FileContentGetOrCreate'.encode('ascii') + checksum_sha256) \
            .digest(8)
        return int.from_bytes(h, byteorder='big', signed=True)

    @classmethod
    def get_or_create(cls, file: BinaryIO, checksum_sha256: bytes = None) -> int:
        """Get the existing FileContent row for the given file or create a new row
        if needed.

        A lock is acquired for the operation with granularity down to
        the specific file, and it is only released at the end of the transaction.
        Do not add more than one file in the same transaction while using this method
        otherwise you will risk a deadlock.

        This method does not commit the transaction.

        :param file: a file-like object
        :param checksum_sha256: the checksum of the file (computed if not provided)
        :return: the ID of the file
        """

        content: Optional[bytes]

        if checksum_sha256 is None:
            content = file.read()
            file.seek(0)
            checksum_sha256 = hashlib.sha256(content).digest()
        else:
            content = None

        # We need to deal with a potential race condition. We can't rely on
        # transactions because transactions don't block each other (no matter the
        # isolation level, a transaction would deal with either a dirty read or a race
        # condition). Here we acquire a lock specific for this file to be added
        # into the DB, which will block any other threads attempting to add
        # the same file (assuming that they too acquire the same lock).
        # The lock is released at the end of the transaction to
        # prevent a dirty read occurring in another thread creating a FK error in their code.
        # The only downside to acquiring a lock is that it could result in a deadlock,
        # so hopefully the calling code isn't doing anything fancy beyond
        # adding one file to the database. Please don't add more than one file
        # in the same transaction (!). If later we require batch file adding, consider
        # sorting the files in a stable manner (like by the checksum) and then acquiring
        # the locks in the same order.
        db.session.execute(db.select([
            db.func.pg_advisory_xact_lock(
                db.cast(cls.get_file_lock_hash(checksum_sha256), db.BIGINT)
            )
        ]))

        try:
            return db.session.query(FileContent.id) \
                .filter(FileContent.checksum_sha256 == checksum_sha256) \
                .one()[0]
        except NoResultFound:
            if content is None:
                content = file.read()

            row = FileContent()
            row.checksum_sha256 = checksum_sha256
            row.raw_file = content
            db.session.add(row)
            db.session.flush()

            assert row.id is not None
            return row.id


@dataclass
class FilePrivileges:
    readable: bool
    writable: bool
    commentable: bool


class Files(RDBMSBase, FullTimestampMixin, RecyclableMixin, HashIdMixin):  # type: ignore
    MAX_DEPTH = 50

    __tablename__ = 'files'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    filename = db.Column(db.String(200), nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey('files.id'), nullable=True, index=True)
    parent = db.relationship('Files', foreign_keys=parent_id, uselist=False, remote_side=[id])
    mime_type = db.Column(db.String(127), nullable=False)
    description = db.Column(db.Text, nullable=True)
    content_id = db.Column(db.Integer, db.ForeignKey('files_content.id', ondelete='CASCADE'),
                           index=True, nullable=True)
    content = db.relationship('FileContent', foreign_keys=content_id)
    user_id = db.Column(db.Integer, db.ForeignKey('appuser.id', ondelete='CASCADE'),
                        index=True, nullable=False)
    user = db.relationship('AppUser', foreign_keys=user_id)
    doi = db.Column(db.String(1024), nullable=True)
    upload_url = db.Column(db.String(2048), nullable=True)
    public = db.Column(db.Boolean, nullable=False, default=False)
    deletion_date = db.Column(TIMESTAMP(timezone=True), nullable=True)
    recycling_date = db.Column(TIMESTAMP(timezone=True), nullable=True)

    """
    Annotations related columns
    """
    annotations = db.Column(postgresql.JSONB, nullable=True, server_default='[]')
    annotation_configs = db.Column(postgresql.JSONB, nullable=True)
    annotations_date = db.Column(TIMESTAMP(timezone=True), nullable=True)
    custom_annotations = db.Column(postgresql.JSONB, nullable=True, server_default='[]')
    enrichment_annotations = db.Column(postgresql.JSONB, nullable=True)
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

    __table_args__ = (
        db.Index('uq_files_unique_filename', 'filename', 'parent_id',
                 unique=True,
                 postgresql_where=and_(deletion_date.is_(None),
                                       recycling_date.is_(None),
                                       parent_id.isnot(None))),
    )

    # These fields are not available when initially queried but you can set these fields
    # yourself or use helpers that populate these fields. These fields are used by
    # a lot of the API endpoints, and some of the helper methods that query for Files
    # will populate these fields for you
    calculated_project: Optional[Projects] = None
    calculated_privileges: Dict[int, FilePrivileges]  # key = AppUser.id
    calculated_children: Optional[List['Files']] = None  # children of this file
    calculated_parent_deleted: Optional[bool] = None  # whether a parent is deleted
    calculated_parent_recycled: Optional[bool] = None  # whether a parent is recycled
    calculated_highlight: Optional[str] = None  # highlight used in the content search

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._init_model()

    @orm.reconstructor
    def _init_model(self):
        self.calculated_privileges = {}

    @property
    def parent_deleted(self):
        value = self.calculated_parent_deleted
        assert value is not None
        return value

    @property
    def parent_recycled(self):
        value = self.calculated_parent_recycled
        assert value is not None
        return value

    @property
    def effectively_recycled(self):
        return self.recycled or self.parent_recycled

    def generate_non_conflicting_filename(self):
        """Generate a new filename based of the current filename when there is a filename
        conflict with another file in the same folder.

        The returned filename could still conflict due to a race condition if you are
        not fast enough. With haste!

        :return: a new filename
        :raises:
            ValueError: if a new (reasonable) filename cannot be found
        """

        file_name, file_ext = os.path.splitext(self.filename)
        file_ext_len = len(file_ext)

        # Remove the file extension from the filename column in the table
        c_file_name = sqlalchemy.func.left(Files.filename,
                                           -file_ext_len) if file_ext_len else Files.filename

        # Extract the N from (N) in the filename
        c_name_matches = sqlalchemy.func.regexp_matches(
            c_file_name,
            '^.* \\(([0-9]+)\\)$',
            type_=sqlalchemy.ARRAY(sqlalchemy.Text))

        # regexp_matches() returns an array so get the first result
        c_name_index = c_name_matches[1]

        # Search the table for all files that have {this_filename} (N){ext}
        q_used_indices = db.session.query(
            sqlalchemy.cast(c_name_index, sqlalchemy.Integer).label('index')) \
            .select_from(Files) \
            .filter(Files.parent_id == self.parent_id,
                    Files.filename.op('~')(
                        f'^{re.escape(file_name)} \\(([0-9]+)\\){re.escape(file_ext)}$'),
                    Files.recycling_date.is_(None),
                    Files.deletion_date.is_(None)) \
            .subquery()

        # Finally get the MAX() of all the Ns found in the subquery
        max_index = db.session.query(
            sqlalchemy.func.max(q_used_indices.c.index).label('index')
        ).select_from(
            q_used_indices
        ).scalar() or 0

        next_index = max_index + 1

        new_filename = f"{file_name} ({next_index}){file_ext}"

        # Check that the new filename doesn't exceed the length of the column
        if len(self.filename) > Files.filename.property.columns[0].type.length:
            raise ValueError('new filename would exceed the length of the column')

        return new_filename


# Files table ORM event listeners
@event.listens_for(Files, 'after_insert')
@event.listens_for(Files, 'after_delete')
@event.listens_for(Files, 'after_update')
def file_change(mapper, connection, target: Files):
    elastic_service = get_elastic_service()
    elastic_service.index_or_delete_files([target.hash_id])


class AnnotationChangeCause(enum.Enum):
    USER = 'user'
    USER_REANNOTATION = 'user_reannotation'
    SYSTEM_REANNOTATION = 'sys_reannotation'


class FileAnnotationsVersion(RDBMSBase, TimestampMixin, HashIdMixin):
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    file_id = db.Column(db.Integer, db.ForeignKey('files.id', ondelete='CASCADE'),
                        index=True, nullable=False)
    file = db.relationship('Files', foreign_keys=file_id)
    cause = db.Column(db.Enum(AnnotationChangeCause), nullable=False)
    custom_annotations = db.Column(postgresql.JSONB, nullable=True, server_default='[]')
    excluded_annotations = db.Column(postgresql.JSONB, nullable=True, server_default='[]')
    user_id = db.Column(db.Integer, db.ForeignKey('appuser.id', ondelete='SET NULL'),
                        index=True, nullable=True)
    user = db.relationship('AppUser', foreign_keys=user_id)


class FallbackOrganism(RDBMSBase):
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    organism_name = db.Column(db.String(200), nullable=False)
    organism_synonym = db.Column(db.String(200), nullable=False)
    organism_taxonomy_id = db.Column(db.String(50), nullable=False)

    @property
    def tax_id(self):
        # Required for FallbackOrganismSchema
        return self.organism_taxonomy_id

    @property
    def synonym(self):
        # Required for FallbackOrganismSchema
        return self.organism_synonym


class FileVersion(RDBMSBase, FullTimestampMixin, HashIdMixin):
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


class FileBackup(RDBMSBase, FullTimestampMixin, HashIdMixin):
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    file_id = db.Column(db.Integer, db.ForeignKey('files.id'),
                        index=True, nullable=False)
    file = db.relationship('Files', foreign_keys=file_id)
    raw_value = db.Column(db.LargeBinary, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('appuser.id', ondelete='CASCADE'),
                        index=True, nullable=False)
    user = db.relationship('AppUser', foreign_keys=user_id)


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


class FileLock(RDBMSBase, TimestampMixin):
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    hash_id = db.Column(db.String(50), index=True, nullable=False, unique=True)
    user_id = db.Column(db.Integer, db.ForeignKey('appuser.id', ondelete='CASCADE'),
                        index=True, nullable=False)
    user = db.relationship('AppUser', foreign_keys=user_id)
    acquire_date = db.Column(TIMESTAMP(timezone=True), default=db.func.now(), nullable=False)
