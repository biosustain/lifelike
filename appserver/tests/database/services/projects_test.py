import pytest
import os
from pathlib import Path
from sqlalchemy import and_
from typing import Sequence

from neo4japp.models.files import Directory
from neo4japp.models.projects import (
    Projects,
    projects_collaborator_role,
)
from neo4japp.models.auth import (
    AccessControlPolicy,
    AppRole,
    AppUser,
)
from neo4japp.services import ProjectsService


@pytest.fixture(scope='function')
def nested_dirs(session, fix_projects) -> Sequence[Directory]:
    """ Mock directories
    /child1-a
    /child1-a/child-2a
    /child1-b
    """
    ***ARANGO_USERNAME***_dir = Directory(
        name='/',
        directory_parent_id=None,
        projects_id=fix_projects.id,
    )

    session.add(***ARANGO_USERNAME***_dir)
    session.flush()

    child_1a = Directory(
        name='child-1a',
        directory_parent_id=***ARANGO_USERNAME***_dir.id,
        projects_id=fix_projects.id,
    )
    session.add(child_1a)

    child_1b = Directory(
        name='child-1b',
        directory_parent_id=***ARANGO_USERNAME***_dir.id,
        projects_id=fix_projects.id,
    )
    session.add(child_1b)
    session.flush()

    child_2 = Directory(
        name='child-2a',
        directory_parent_id=child_1a.id,
        projects_id=fix_projects.id,
    )
    session.add(child_2)
    session.flush()
    return [child_2, [child_1a, child_1b], ***ARANGO_USERNAME***_dir]


@pytest.mark.parametrize('***ARANGO_USERNAME***_path, expected', [
    ('/', ['child-1a', 'child-1b']),
    ('/child-1a', ['child-2a']),
    ('/child-1b', []),
    ('/child-1a/child-2a', [])
])
def test_get_immediate_children(session, fix_projects, nested_dirs, ***ARANGO_USERNAME***_path, expected):
    proj_service = ProjectsService(session)
    dirname = os.path.basename(Path(***ARANGO_USERNAME***_path))

    if not dirname:
        dirname = '/'

    curr_dir = session.query(Directory).filter(
        and_(
            Directory.name == dirname,
            Directory.projects_id == fix_projects.id
        )
    ).one()

    child_dirs = proj_service.get_immediate_child_dirs(fix_projects, curr_dir)
    child_dirs = [d.name for d in child_dirs]
    assert set(child_dirs) == set(expected)


@pytest.mark.parametrize('***ARANGO_USERNAME***_path, expected', [
    ('/', ['/', 'child-1a', 'child-1b', 'child-2a']),
    ('/child-1a', ['child-1a', 'child-2a']),
    ('/child-1b', ['child-1b']),
    ('/child-1a/child-2a', ['child-2a'])
])
def test_get_all_child_dirs(session, fix_projects, nested_dirs, ***ARANGO_USERNAME***_path, expected):
    proj_service = ProjectsService(session)
    dirname = os.path.basename(Path(***ARANGO_USERNAME***_path))

    if not dirname:
        dirname = '/'

    curr_dir = session.query(Directory).filter(
        and_(
            Directory.name == dirname,
            Directory.projects_id == fix_projects.id
        )
    ).one()

    child_dirs = proj_service.get_all_child_dirs(fix_projects, curr_dir)
    child_dirs = [d.name for d in child_dirs]
    assert set(child_dirs) == set(expected)


def test_can_get_***ARANGO_USERNAME***_dir(session, fix_projects, fix_directory):
    proj_service = ProjectsService(session)
    assert proj_service.get_***ARANGO_USERNAME***_dir(fix_projects).name == '/'


def test_can_add_project_role(session, fix_projects, test_user):
    proj_service = ProjectsService(session)
    role = AppRole.query.filter(AppRole.name == 'project-read').one()
    proj_service.add_role(test_user, role, fix_projects)

    user_has_role = session.query(
        AppUser,
    ).filter(
        AppUser.id == test_user.id
    ).join(
        projects_collaborator_role
    ).join(
        AppRole
    ).filter(
        AppRole.name == 'project-read'
    ).join(
        Projects
    ).filter(
        Projects.id == fix_projects.id
    ).one_or_none()

    assert user_has_role is not None


def test_can_delete_project_role(session, fix_projects, test_user):
    proj_service = ProjectsService(session)
    role = AppRole.query.filter(AppRole.name == 'project-read').one()
    proj_service.delete_role(test_user, role, fix_projects)

    user_has_role = session.query(
        AppUser,
    ).filter(
        AppUser.id == test_user.id
    ).join(
        projects_collaborator_role
    ).join(
        AppRole
    ).filter(
        AppRole.name == 'project-read'
    ).join(
        Projects
    ).filter(
        Projects.id == fix_projects.id
    ).one_or_none()

    assert user_has_role is None


def test_owner_gets_default_admin_permission(session, test_user):
    proj_service = ProjectsService(session)
    projects = Projects(
        project_name='cookie',
        description='monster',
        users=[],
    )
    session.add(projects)
    session.flush()
    new_project = proj_service.create_projects(test_user, projects)

    user_has_role = session.query(
        AppUser,
    ).filter(
        AppUser.id == test_user.id
    ).join(
        projects_collaborator_role
    ).join(
        AppRole
    ).filter(
        AppRole.name == 'project-admin'
    ).join(
        Projects
    ).filter(
        Projects.id == new_project.id
    ).one_or_none()

    assert user_has_role is not None
