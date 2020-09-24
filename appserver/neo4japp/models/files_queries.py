"""TODO: Possibly turn this into a DAO in the future.
For now, it's just a file with query functions to help DRY.
"""
from typing import List, Set

from sqlalchemy import and_, inspect
from sqlalchemy.orm import raiseload, contains_eager
from sqlalchemy.orm.exc import NoResultFound

from . import projects_collaborator_role, AppUser, AppRole, Projects
from .files import Files, FileContent, file_collaborator_role

from neo4japp.database import db


def get_all_files_and_content_by_id(file_ids: Set[str], project_id: int):
    return db.session.query(
        Files.id,
        Files.annotations,
        Files.custom_annotations,
        Files.file_id,
        Files.filename,
        FileContent.raw_file,
    ).join(
        FileContent,
        FileContent.id == Files.content_id,
    ).filter(
        and_(
            Files.project == project_id,
            Files.file_id.in_(file_ids),
        ),
    )


def get_all_files_by_id(file_ids: Set[str], project_id: int):
    files = db.session.query(
        Files,
    ).filter(
        and_(
            Files.project == project_id,
            Files.file_id.in_(file_ids),
        ),
    ).all()
    return files


def get_file_parent_hierarchy(filter):
    q_hierarchy = db.session.query(
        Files.id,
        Files.parent_id,
        db.literal(0).label('level')
    ) \
        .join(Projects, Projects.id == Files.project_id) \
        .filter(filter) \
        .cte(recursive=True)

    t_parent = db.aliased(q_hierarchy, name="parent")
    t_children = db.aliased(Files, name="child")

    q_hierarchy = q_hierarchy.union_all(db.session.query(
        t_children.id,
        t_children.parent_id,
        (t_parent.c.level + 1).label("level")
    ).filter(t_children.id == t_parent.c.parent_id))

    return q_hierarchy


def add_project_user_role_columns(query, project_table, role_names, user_id, column_format="has_{}"):
    for role_name in role_names:
        t_role = db.aliased(AppRole)
        t_user = db.aliased(AppUser)

        project_role_sq = db.session.query(projects_collaborator_role, t_role.name) \
            .join(t_role, t_role.id == projects_collaborator_role.c.app_role_id) \
            .join(t_user, t_user.id == projects_collaborator_role.c.appuser_id) \
            .subquery()

        query = query \
            .outerjoin(project_role_sq, and_(project_role_sq.c.projects_id == project_table.id,
                                             project_role_sq.c.appuser_id == user_id,
                                             project_role_sq.c.name == role_name)) \
            .add_column(project_role_sq.c.name.isnot(None).label(column_format.format(role_name)))

    return query


def add_file_user_role_columns(query, file_table, role_names, user_id, column_format="has_{}"):
    for role_name in role_names:
        t_role = db.aliased(AppRole)
        t_user = db.aliased(AppUser)

        project_role_sq = db.session.query(file_collaborator_role, t_role.name) \
            .join(t_role, t_role.id == file_collaborator_role.c.role_id) \
            .join(t_user, t_user.id == file_collaborator_role.c.collaborator_id) \
            .subquery()

        query = query \
            .outerjoin(project_role_sq, and_(project_role_sq.c.file_id == file_table.id,
                                             project_role_sq.c.collaborator_id == user_id,
                                             project_role_sq.c.name == role_name)) \
            .add_column(project_role_sq.c.name.isnot(None).label(column_format.format(role_name)))

    return query


def add_user_permission_columns(query, project_table, file_table, user_id):
    query = add_project_user_role_columns(query, project_table, [
        'project-read',
        'project-write',
        'project-admin'
    ], user_id, f'has_{{}}_{user_id}')

    query = add_file_user_role_columns(query, file_table, [
        'file-read',
        'file-write',
        'file-comment'
    ], user_id, f'has_{{}}_{user_id}')

    return query


class FileHierarchy:
    def __init__(self, results, file_table):
        self.results = list(map(lambda item: item._asdict(), results))
        self.file_table = file_table
        self.file_key = inspect(self.file_table).name

    @property
    def file(self) -> Files:
        return self.results[0][self.file_key]

    @property
    def hierarchy(self) -> List[Files]:
        return [row[self.file_key] for row in self.results]

    @property
    def parents(self) -> List[Files]:
        return [row[self.file_key] for row in self.results[1:]]

    def may_read(self, user_id):
        target = self.results[0]
        if target[f'has_project-read_{user_id}'] or target[f'has_project-admin_{user_id}']:
            return True
        for row in self.results:
            if row[f'has_file-read_{user_id}']:
                return True
        return False

    def may_write(self, user_id):
        target = self.results[0]
        if target[f'has_project-write_{user_id}'] or target[f'has_project-admin_{user_id}']:
            return True
        for row in self.results:
            if row[f'has_file-write_{user_id}']:
                return True
        return False

    def may_comment(self, user_id):
        target = self.results[0]
        if target[f'has_project-read_{user_id}'] or target[f'has_project-admin_{user_id}']:
            return True
        for row in self.results:
            if row[f'has_file-comment_{user_id}']:
                return True
        return False
