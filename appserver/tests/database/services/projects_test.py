import pytest
import os
from pathlib import Path
from sqlalchemy import and_
from neo4japp.models import (
    AppRole,
    AppUser,
    Directory,
    Projects,
    projects_collaborator_role,
)
from neo4japp.services import ProjectsService
from typing import Sequence


@pytest.fixture(scope='function')
def nested_dirs(session, fix_projects) -> Sequence[Directory]:
    """ Mock directories
    /child1-a
    /child1-a/child-2a
    /child1-b
    """
    root_dir = Directory(
        name='/',
        directory_parent_id=None,
        projects_id=fix_projects.id,
    )

    session.add(root_dir)
    session.flush()

    child_1a = Directory(
        name='child-1a',
        directory_parent_id=root_dir.id,
        projects_id=fix_projects.id,
    )
    session.add(child_1a)

    child_1b = Directory(
        name='child-1b',
        directory_parent_id=root_dir.id,
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
    return [child_2, [child_1a, child_1b], root_dir]


@pytest.mark.parametrize('root_path, expected', [
    ('/', ['child-1a', 'child-1b']),
    ('/child-1a', ['child-2a']),
    ('/child-1b', []),
    ('/child-1a/child-2a', [])
])
def test_get_immediate_children(session, fix_projects, nested_dirs, root_path, expected):
    proj_service = ProjectsService(session)
    dirname = os.path.basename(Path(root_path))

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


@pytest.mark.parametrize('root_path, expected', [
    ('/', ['/', 'child-1a', 'child-1b', 'child-2a']),
    ('/child-1a', ['child-1a', 'child-2a']),
    ('/child-1b', ['child-1b']),
    ('/child-1a/child-2a', ['child-2a'])
])
def test_get_all_child_dirs(session, fix_projects, nested_dirs, root_path, expected):
    proj_service = ProjectsService(session)
    dirname = os.path.basename(Path(root_path))

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


def test_can_get_root_dir(session, fix_projects, fix_directory):
    proj_service = ProjectsService(session)
    assert proj_service.get_root_dir(fix_projects).name == '/'


@pytest.mark.parametrize('role', [
    'project-admin',
    'project-read',
    'project-write',
])
def test_can_set_user_role(session, test_user, fix_projects, role):
    app_role = AppRole(name=role)
    session.add(app_role)
    session.flush()

    session.execute(
        projects_collaborator_role.insert(),
        [dict(
            appuser_id=test_user.id,
            app_role_id=app_role.id,
            projects_id=fix_projects.id,
        )]
    )
    session.flush()

    user_has_role = session.query(
        AppUser,
    ).filter(
        AppUser.id == test_user.id,
    ).join(
        projects_collaborator_role
    ).join(
        AppRole
    ).filter(
        AppRole.name == role,
    ).join(
        Projects
    ).filter(
        Projects.id == fix_projects.id,
    ).one_or_none()

    assert user_has_role is not None
