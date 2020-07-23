import pytest
import os
import json
from datetime import date
from pathlib import Path
from sqlalchemy import and_
from typing import Sequence

from neo4japp.exceptions import DirectoryError
from neo4japp.models.files import Directory
from neo4japp.models.drawing_tool import Project
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


def test_can_add_directory(session, fix_owner, fix_projects, fix_directory):
    proj_service = ProjectsService(session)
    new_dir = proj_service.add_directory(
        projects=fix_projects,
        dir_name='purple_rain',
        user=fix_owner
    )
    created_dir = session.query(Directory).filter(
        Directory.name == new_dir.name
    ).one_or_none()
    assert created_dir is not None


def test_can_add_project_collaborator(session, fix_projects, test_user):
    proj_service = ProjectsService(session)
    role = AppRole.query.filter(AppRole.name == 'project-read').one()
    proj_service.add_collaborator(test_user, role, fix_projects)

    user_role = Projects.query_project_roles(
        test_user.id, fix_projects.id
    ).one_or_none()

    assert user_role.name == 'project-read'


def test_can_delete_project_collaborator(session, fix_projects, test_user):
    proj_service = ProjectsService(session)
    proj_service.remove_collaborator(test_user, fix_projects)

    user_role = Projects.query_project_roles(
        test_user.id, fix_projects.id
    ).one_or_none()

    assert user_role is None


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

    user_role = Projects.query_project_roles(
        test_user.id, new_project.id
    ).one_or_none()

    assert user_role.name == 'project-admin'


@pytest.mark.parametrize('original_name, new_name', [
    ('purple_rain', 'blue_rain'),
    ('c o u n t r y', 'b l u e s!'),
    ('king', ' king ')
])
def test_can_rename_directory(session, fix_projects, fix_directory, original_name, new_name):
    proj_service = ProjectsService(session)
    new_dir = proj_service.add_directory(
        projects=fix_projects,
        dir_name=original_name,
    )

    current_dir = session.query(Directory).filter(
        Directory.name == new_dir.name
    ).one_or_none()

    assert current_dir is not None

    proj_service.rename_directory(new_name, current_dir)

    old_dir_name = session.query(Directory).filter(
        Directory.name == original_name
    ).one_or_none()

    assert old_dir_name is None

    renamed_dir = session.query(Directory).filter(
        Directory.name == new_name
    ).one_or_none()

    assert renamed_dir is not None
    assert renamed_dir.name == new_name


def test_can_delete_directory(session, fix_projects, fix_directory):
    proj_service = ProjectsService(session)
    new_dir = proj_service.add_directory(
        projects=fix_projects,
        dir_name='nested',
    )
    proj_service.delete_directory(new_dir)
    assert Directory.query.filter(Directory.id == new_dir.id).one_or_none() is None


def test_cannot_delete_root_dir(session, fix_projects, fix_directory):
    proj_service = ProjectsService(session)
    with pytest.raises(DirectoryError):
        proj_service.delete_directory(fix_directory)


def test_cannot_delete_nonempty_dir(session, fix_owner, fix_nested_dir):
    project = Project(
        id=808,
        label='&heartbreaks',
        description='beforecr8zy',
        author='yeezy',
        date_modified=str(date.today()),
        graph=json.dumps({}),
        user_id=fix_owner.id,
        dir_id=fix_nested_dir.id,
    )
    session.add(project)
    session.flush()
    proj_service = ProjectsService(session)

    with pytest.raises(DirectoryError):
        proj_service.delete_directory(fix_nested_dir)

    session.delete(project)
    session.flush()

    proj_service.delete_directory(fix_nested_dir)
    assert Directory.query.filter(Directory.id == fix_nested_dir.id).one_or_none() is None


def test_can_move_directory(session, fix_directory, fix_nested_dir):
    proj_service = ProjectsService(session)
    child_dir_2 = Directory(
        name='child-level-2',
        directory_parent_id=fix_nested_dir.id,
        projects_id=fix_nested_dir.projects_id,
    )
    session.add(child_dir_2)
    session.flush()

    assert child_dir_2.directory_parent_id == fix_nested_dir.id
    proj_service.move_directory(child_dir_2, fix_directory)
    assert Directory.query.get(child_dir_2.id).directory_parent_id == fix_directory.id


def test_can_move_map(session, fix_project, fix_directory, fix_nested_dir):
    proj_service = ProjectsService(session)

    assert fix_project.dir_id == fix_directory.id

    proj_service.move_map(fix_project, fix_nested_dir)

    assert fix_project.dir_id == fix_nested_dir.id
