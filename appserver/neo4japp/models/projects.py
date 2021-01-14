import re
from dataclasses import dataclass
from typing import Dict

from sqlalchemy import (
    and_,
    event,
    join,
    select
)
from sqlalchemy.orm import validates
from sqlalchemy.orm.query import Query

from neo4japp.constants import FILE_INDEX_ID
from neo4japp.database import db, get_elastic_service
from neo4japp.models.auth import (
    AccessActionType,
    AccessControlPolicy,
    AccessRuleType,
    AppRole,
    AppUser,
)
from neo4japp.models.common import RDBMSBase, FullTimestampMixin, HashIdMixin

projects_collaborator_role = db.Table(
    'projects_collaborator_role',
    db.Column(
        'appuser_id',
        db.Integer,
        db.ForeignKey('appuser.id', ondelete='CASCADE'),
        primary_key=True,
        index=True
    ),
    db.Column(
        'app_role_id',
        db.Integer,
        db.ForeignKey('app_role.id', ondelete='CASCADE'),
        primary_key=True,
        index=True
    ),
    db.Column(
        'projects_id',
        db.Integer,
        db.ForeignKey('projects.id', ondelete='CASCADE'),
        primary_key=True,
        index=True
    )
)


@dataclass
class ProjectPrivileges:
    readable: bool
    writable: bool
    administrable: bool


class Projects(RDBMSBase, FullTimestampMixin, HashIdMixin):  # type: ignore
    API_FIELDS = [
        'hash_id',
        'name',
        'description',
        'creation_date',
        'modified_date',
    ]

    __tablename__ = 'projects'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(250), unique=True, nullable=False)
    description = db.Column(db.Text)
    ***ARANGO_USERNAME***_id = db.Column(db.Integer, db.ForeignKey('files.id'), nullable=False, index=True)
    ***ARANGO_USERNAME*** = db.relationship('Files', foreign_keys=***ARANGO_USERNAME***_id)

    # These fields are not available when initially queried but you can set these fields
    # yourself or use helpers that populate these fields. These fields are used by
    # a lot of the API endpoints, and some of the helper methods that query for Files
    # will populate these fields for you
    calculated_privileges: Dict[int, ProjectPrivileges] = {}  # key = AppUser.id

    @validates('name')
    def validate_name(self, key, name):
        if not re.match('^[A-Za-z0-9-]+$', name):
            raise ValueError(f'incorrect project name format')
        return name

    @classmethod
    def query_project_roles(cls, user_id: int, project_id: int) -> Query:
        return db.session.query(
            AppRole
        ).join(
            projects_collaborator_role
        ).join(
            cls
        ).filter(
            cls.id == project_id
        ).join(
            AppUser
        ).filter(
            AppUser.id == user_id
        )


@event.listens_for(Projects, 'after_insert')
def init_default_access(mapper, connection, target):
    # Sets up the "READ" role
    read_role = connection.execute(AppRole.__table__.select().where(
        AppRole.__table__.c.name == 'project-read'
    )).fetchone()
    if read_role is None:
        connection.execute(AppRole.__table__.insert().values(name='project-read'))
        read_role = connection.execute(AppRole.__table__.select().where(
            AppRole.__table__.c.name == 'project-read'
        )).fetchone()

    connection.execute(AccessControlPolicy.__table__.insert().values(
        action=AccessActionType.READ,
        asset_type=target.__tablename__,
        asset_id=target.id,
        principal_type=AppRole.__tablename__,
        principal_id=read_role.id,
        rule_type=AccessRuleType.ALLOW,
    ))
    connection.execute(AccessControlPolicy.__table__.insert().values(
        action=AccessActionType.WRITE,
        asset_type=target.__tablename__,
        asset_id=target.id,
        principal_type=AppRole.__tablename__,
        principal_id=read_role.id,
        rule_type=AccessRuleType.DENY,
    ))

    # Sets up the "WRITE" role
    write_role = connection.execute(AppRole.__table__.select().where(
        AppRole.__table__.c.name == 'project-write'
    )).fetchone()
    if write_role is None:
        connection.execute(AppRole.__table__.insert().values(name='project-write'))
        write_role = connection.execute(AppRole.__table__.select().where(
            AppRole.__table__.c.name == 'project-write'
        )).fetchone()

    connection.execute(AccessControlPolicy.__table__.insert().values(
        action=AccessActionType.READ,
        asset_type=target.__tablename__,
        asset_id=target.id,
        principal_type=AppRole.__tablename__,
        principal_id=write_role.id,
        rule_type=AccessRuleType.ALLOW,
    ))
    connection.execute(AccessControlPolicy.__table__.insert().values(
        action=AccessActionType.WRITE,
        asset_type=target.__tablename__,
        asset_id=target.id,
        principal_type=AppRole.__tablename__,
        principal_id=write_role.id,
        rule_type=AccessRuleType.ALLOW,
    ))

    # Sets up the "ADMIN" role
    admin_role = connection.execute(AppRole.__table__.select().where(
        AppRole.__table__.c.name == 'project-admin'
    )).fetchone()
    if admin_role is None:
        connection.execute(AppRole.__table__.insert().values(name='project-admin'))
        admin_role = connection.execute(AppRole.__table__.select().where(
            AppRole.__table__.c.name == 'project-admin'
        )).fetchone()

    connection.execute(AccessControlPolicy.__table__.insert().values(
        action=AccessActionType.READ,
        asset_type=target.__tablename__,
        asset_id=target.id,
        principal_type=AppRole.__tablename__,
        principal_id=admin_role.id,
        rule_type=AccessRuleType.ALLOW,
    ))
    connection.execute(AccessControlPolicy.__table__.insert().values(
        action=AccessActionType.WRITE,
        asset_type=target.__tablename__,
        asset_id=target.id,
        principal_type=AppRole.__tablename__,
        principal_id=admin_role.id,
        rule_type=AccessRuleType.ALLOW,
    ))
