"""TODO: Possibly turn this into a DAO in the future.
For now, it's just a file with query functions to help DRY.
"""
from typing import List, Set, Dict, Optional

from flask_sqlalchemy import BaseQuery
from sqlalchemy import and_, inspect
from sqlalchemy.orm import contains_eager, aliased, Query

from neo4japp.database import db
from . import projects_collaborator_role, AppUser, AppRole, Projects
from .files import Files, FileContent, file_collaborator_role, FallbackOrganism
from ..schemas.filesystem import FilePrivileges


def get_all_files_and_content_by_id(file_ids: Set[str], project_id: int):
    sub_query = db.session.query(FallbackOrganism.id.label('fallback_organism_id')).subquery()
    query = db.session.query(
        Files.id,
        Files.annotations,
        Files.custom_annotations,
        Files.excluded_annotations,
        Files.file_id,
        Files.filename,
        FileContent.raw_file,
        sub_query.c.fallback_organism_id
    ).join(
        FileContent,
        FileContent.id == Files.content_id,
    ).filter(
        and_(
            Files.project == project_id,
            Files.file_id.in_(file_ids),
        ),
    )

    return query.outerjoin(
        sub_query,
        and_(sub_query.c.fallback_organism_id == Files.fallback_organism_id))


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


def build_file_parents_cte(filter, max_depth=Files.MAX_DEPTH,
                           files_table=Files, projects_table=Projects) -> BaseQuery:
    """
    Build a query for fetching *just* the parent IDs of a file, and the file itself.
    The query returned is to be combined with another query to actually
    fetch file or file information (see :func:`get_file_hierarchy_query`).

    :param filter: WHERE for finding the desired file (i.e. Files.id == X)
    :param max_depth: a maximum number of parents to return (infinite recursion mitigation)
    :param files_table: a files table to use, if not the default Files model
    :param projects_table: a projects table to use, if not the default Projects model
    :return: a hierarchy CTE query
    """

    # This CTE gets the child and then joins all parents of the child, getting us
    # the whole hierarchy. We need the whole hierarchy to (1) determine the
    # project (projects have one root level directory), (2) determine the
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
        .outerjoin(projects_table, projects_table.root_id == files_table.id) \
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
            .outerjoin(projects_table, projects_table.root_id == t_children.id) \
            .filter(t_children.id == t_parent.c.parent_id,
                    t_parent.c.level < max_depth))  # len(results) will max at (max_depth + 1)

    # The returned hierarchy doesn't provide any permissions or project information --
    # it only provides a sequence of file IDs (and related hierarchy information)
    # that can be joined onto a query

    return q_hierarchy


def join_projects_to_parents_cte(q_hierarchy: Query):
    """
    Using the query from :func:`get_get_file_parent_hierarchy_query`, this methods joins
    the project ID for the initial file row(s), provided the top-most parent (root) of
    that initial file row has a project.

    :param q_hierarchy: the hierarchy query
    :return: a new query
    """
    return db.session.query(
        q_hierarchy.c.initial_id,
        db.func.max(q_hierarchy.c.project_id).label('project_id'),
    ) \
        .select_from(q_hierarchy) \
        .group_by(q_hierarchy.c.initial_id) \
        .subquery()


def build_file_hierarchy_query_parts(condition, projects_table, files_table,
                                     include_deleted_projects=False,
                                     include_deleted_files=False) -> Dict[str, BaseQuery]:
    """
    Build a query for fetching a file, its parents, and the related project(s), while
    (optionally) excluding deleted projects and deleted projects.

    :param condition: the condition to limit the files returned
    :param projects_table: a reference to the projects table used in the query
    :param files_table: a reference to the files table used in the query
    :param include_deleted_projects: whether to include deleted projects
    :return: a query
    """

    # Goals:
    # - Remove deleted files (done in recursive CTE)
    # - Remove deleted projects (done in main query)
    # - Fetch permissions (done in main query)
    # Do it in one query efficiently

    # Fetch the target file and its parents
    q_hierarchy = build_file_parents_cte(and_(
        condition,
        *([files_table.deleted_date.is_(None)] if include_deleted_files else []),
    ))

    # Only the top-most directory has a project FK, so we need to reorganize
    # the query results from the CTE so we have a project ID for every file row
    q_hierarchy_project = join_projects_to_parents_cte(q_hierarchy)

    t_parent_files = aliased(files_table)

    # Main query
    query = db.session.query(files_table,
                             q_hierarchy.c.initial_id,
                             q_hierarchy.c.level,
                             projects_table) \
        .join(q_hierarchy, q_hierarchy.c.id == files_table.id) \
        .join(q_hierarchy_project, q_hierarchy_project.c.initial_id == q_hierarchy.c.initial_id) \
        .join(projects_table, projects_table.root_id == q_hierarchy_project.c.project_id) \
        .outerjoin(t_parent_files, t_parent_files.id == files_table.parent_id) \
        .options(contains_eager(files_table.parent, alias=t_parent_files)) \
        .order_by(q_hierarchy.c.level)

    if not include_deleted_projects:
        query = query.filter(projects_table.deletion_date.is_(None))

    return {
        'query': query,
        'q_hierarchy': q_hierarchy,
    }


# noinspection DuplicatedCode
def add_project_user_role_columns(query, project_table, role_names, user_id, column_format="has_{}"):
    """
    Add columns to a query for fetching the value of the provided roles for the
    provided user ID for projects in the provided project table.

    :param query: the query to modify
    :param project_table: the project table
    :param role_names: a list of roles to check
    :param user_id: the user ID to check for
    :param column_format: the format for the name of the column, where {} is the role name
    :return: the new query
    """

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


# noinspection DuplicatedCode
def add_file_user_role_columns(query, file_table, role_names, user_id, column_format="has_{}"):
    """
    Add columns to a query for fetching the value of the provided roles for the
    provided user ID for files in the provided fi;e table.

    :param query: the query to modify
    :param file_table: the file table
    :param role_names: a list of roles to check
    :param user_id: the user ID to check for
    :param column_format: the format for the name of the column, where {} is the role name
    :return: the new query
    """

    for role_name in role_names:
        t_role = db.aliased(AppRole)
        t_user = db.aliased(AppUser)

        file_role_sq = db.session.query(file_collaborator_role, t_role.name) \
            .join(t_role, t_role.id == file_collaborator_role.c.role_id) \
            .join(t_user, t_user.id == file_collaborator_role.c.collaborator_id) \
            .subquery()

        query = query \
            .outerjoin(file_role_sq, and_(file_role_sq.c.file_id == file_table.id,
                                          file_role_sq.c.collaborator_id == user_id,
                                          file_role_sq.c.name == role_name)) \
            .add_column(file_role_sq.c.name.isnot(None).label(column_format.format(role_name)))

    return query


def add_user_permission_columns(query, project_table, file_table, user_id):
    """
    Add the regular project role columns (read, write, admin) and the regular
    file role columns (read, write, comment) to the given query.

    :param query: the query to update
    :param project_table: the projects table to use
    :param file_table: the files table to use
    :param user_id: the user ID to check for
    :return: the new query
    """

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
    """
    Provides accessors for working with the file hierarchy data returned
    from :func:`build_file_parents_cte` and
    :func:`build_file_hierarchy_query`.
    """

    def __init__(self, results, file_table, project_table):
        self.results = [row._asdict() for row in results]
        self.file_table = file_table
        self.project_table = project_table
        self.file_key = inspect(self.file_table).name
        self.project_key = inspect(self.project_table).name
        if self.project_key is None or self.file_key is None:
            raise RuntimeError("the file_table or project_table need to be aliased")

    @property
    def project(self) -> Projects:
        return self.results[0][self.project_key]

    @property
    def file(self) -> Files:
        return self.results[0][self.file_key]

    def calculate_properties(self):
        self.file.calculated_project = self.project

        parent_deleted = False
        parent_recycled = False

        for row in reversed(self.results):
            file: Files = row[self.file_key]

            file.calculated_parent_deleted = parent_deleted
            file.calculated_parent_recycled = parent_recycled

            parent_deleted = parent_deleted or file.deleted
            parent_recycled = parent_recycled or file.recycled

    def calculate_privileges(self, user_ids):
        parent_file: Optional[Files] = None

        # We need to iterate through the files from parent to child because
        # permissions are inherited and must be calculated in that order
        for row in reversed(self.results):
            file: Files = row[self.file_key]

            for user_id in user_ids:
                project_manageable = row[f'has_project-admin_{user_id}']
                project_readable = row[f'has_project-read_{user_id}']
                project_writable = row[f'has_project-write_{user_id}']
                file_readable = row[f'has_file-read_{user_id}']
                file_writable = row[f'has_file-write_{user_id}']
                file_commentable = row[f'has_file-comment_{user_id}']
                parent_privileges = parent_file.calculated_privileges[user_id] if parent_file else None

                commentable = any([
                    project_manageable,
                    project_readable and project_writable,
                    file_commentable,
                    parent_privileges and parent_privileges.commentable,
                ])
                readable = commentable or any([
                    project_manageable,
                    project_readable,
                    file_readable,
                    file.public,
                    parent_privileges and parent_privileges.readable,
                ])
                writable = readable and any([
                    project_manageable,
                    project_writable,
                    file_writable,
                    parent_privileges and parent_privileges.writable,
                ])
                commentable = commentable or writable

                privileges = FilePrivileges(
                    readable=readable,
                    writable=writable,
                    commentable=commentable,
                )

                file.calculated_privileges[user_id] = privileges

            parent_file = file
