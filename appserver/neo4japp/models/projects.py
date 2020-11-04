import enum
import re

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
from neo4japp.models import Files, Project
from neo4japp.models.common import RDBMSBase, TimestampMixin
from neo4japp.models.files import Directory


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


class Projects(RDBMSBase, TimestampMixin):  # type: ignore
    __tablename__ = 'projects'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    project_name = db.Column(db.String(250), unique=True, nullable=False)
    description = db.Column(db.Text)
    users = db.Column(db.ARRAY(db.Integer), nullable=False)

    directories = db.relationship('Directory')

    @validates('project_name')
    def validate_project_name(self, key, name):
        if not re.match('^[A-Za-z0-9-]+$', name):
            raise ValueError('incorrect project name format')
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


@event.listens_for(Projects, 'after_update')
def projects_after_update(mapper, connection, target):
    """listen for the `after_update` event"""

    # Need to re-index all files/maps which use this project, since the name may have changed
    map_id_pairs = connection.execute(
        select([
            Project.__table__.c.id,
            Project.__table__.c.hash_id
        ]).select_from(
            join(
                Project.__table__,
                Directory.__table__,
                Directory.__table__.c.id == Project.__table__.c.dir_id
            ).join(
                Projects.__table__,
                and_(
                    Projects.__table__.c.id == target.id,
                    Projects.__table__.c.id == Directory.__table__.c.projects_id,
                )
            )
        )
    ).fetchall()

    file_id_pairs = connection.execute(
        select([
            Files.__table__.c.id,
            Files.__table__.c.file_id
        ]).where(
            Files.__table__.c.project == target.id
        )
    ).fetchall()

    hash_ids = []
    pdf_ids = []
    map_ids = []
    for map_id, hash_id in map_id_pairs:
        map_ids.append(map_id)
        hash_ids.append(hash_id)

    for pdf_id, hash_id in file_id_pairs:
        pdf_ids.append(pdf_id)
        hash_ids.append(hash_id)

    elastic_service = get_elastic_service()
    elastic_service.delete_documents_with_index(
        file_ids=hash_ids,
        index_id=FILE_INDEX_ID
    )
    elastic_service.index_maps(map_ids)
    elastic_service.index_files(pdf_ids)

# TODO: I suppose we may need a `after_delete` here for updating elastic as well?
# Not sure how we want to handle documents in elastic that have no corresponding project
