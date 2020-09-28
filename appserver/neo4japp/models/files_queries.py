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


def get_file_parent_hierarchy(filter, max_depth=Files.MAX_DEPTH, files_table=Files, projects_table=Projects):
    """
    Build a qurey that will get a hierarchy of one or more files.

    :param filter: WHERE for finding the desired file (i.e. Files.id == X)
    :param max_depth: a maximum number of parents to return (infinite recursion mitigation)
    :param files_table: a files table to use, if not the default Files model
    :param projects_table: a projects table to use, if not the default Projects model
    :return: a hierarchy CTE query
    """

    # This CTE gets the child and then joins all parents of the child, getting us
    # the whole hierarchy. We need the whole hierarchy to (1) determine the
    # project (projects have one ***ARANGO_USERNAME*** level directory), (2) determine the
    # permissions assigned by every level above, and the (3) full
    # filesystem path of the target file or directory

    q_hierarchy = db.session.query(
        files_table.id,
        files_table.parent_id,
        projects_table.id.label('project_id'),
        # If are querying several files, we need to track what file a
        # hierarchy is for, so we put the file ID in initial_id
        files_table.id.label('initial_id'),
        # The level is a depth counter, which is useful for sorting the results
        # and also to provide in a basic infinite recursion mitigation
        db.literal(0).label('level')
    ) \
        .outerjoin(projects_table, projects_table.***ARANGO_USERNAME***_id == files_table.id) \
        .filter(filter) \
        .cte(recursive=True)

    t_parent = db.aliased(q_hierarchy, name="parent")  # Names help debug the query
    t_children = db.aliased(files_table, name="child")

    q_hierarchy = q_hierarchy.union_all(
        db.session.query(
            t_children.id,
            t_children.parent_id,
            projects_table.id.label('project_id'),
            t_parent.c.initial_id,
            (t_parent.c.level + 1).label("level")
        ) \
            .outerjoin(projects_table, projects_table.***ARANGO_USERNAME***_id == t_children.id) \
            .filter(t_children.id == t_parent.c.parent_id,
                    t_parent.c.level < max_depth))  # len(results) will max at (max_depth + 1)

    # The returned hierarchy doesn't provide any permissions or project information --
    # it only provides a sequence of file IDs (and related hierarchy information)
    # that can be joined onto a query

    return q_hierarchy


def get_projects_from_hierarchy(q_hierarchy):
    return db.session.query(
        q_hierarchy.c.initial_id,
        db.func.max(q_hierarchy.c.project_id).label('project_id'),
    ) \
        .select_from(q_hierarchy) \
        .group_by(q_hierarchy.c.initial_id) \
        .subquery()


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
    def __init__(self, results, file_table, project_table):
        self.results = list(map(lambda item: item._asdict(), results))
        self.file_table = file_table
        self.project_table = project_table
        self.file_key = inspect(self.file_table).name
        self.project_key = inspect(self.project_table).name
        if self.project_key is None or self.file_key is None:
            raise RuntimeError("the file_table or project_table need to be aliased")

    @property
    def project(self) -> Files:
        return self.results[0][self.project_key]

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
