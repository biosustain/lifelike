import json
from os import R_OK, access
from os.path import isfile
from typing import Dict, List

import pytest

from neo4japp.blueprints.account import INITIAL_PROJECT_PATH
from neo4japp.models import Files
from neo4japp.models.auth import (
    AppRole, AppUser,
)
from neo4japp.models.projects import (
    Projects,
)
from neo4japp.services import ProjectsService
from neo4japp.services.file_types.providers import DirectoryTypeProvider


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


def test_owner_gets_default_admin_permission(session, test_user: AppUser):
    proj_service = ProjectsService(session)
    root_dir = Files(
        mime_type=DirectoryTypeProvider.MIME_TYPE,
        filename='/',
        user=test_user,
    )
    projects = Projects(
        name='cookie',
        description='monster',
        root=root_dir,
    )
    session.add(root_dir)
    session.add(projects)
    session.flush()
    new_project = proj_service.create_projects(test_user, projects)

    user_role = Projects.query_project_roles(
        test_user.id, new_project.id
    ).one_or_none()

    assert user_role.name == 'project-admin'


def test_initial_project_metadata():
    metadata_file = INITIAL_PROJECT_PATH / 'metadata.json'

    ok = isfile(metadata_file) and access(metadata_file, R_OK)
    assert ok, f'"{metadata_file}" should be an' 'existing, readable file'

    try:
        metadata: Dict[str, List] = json.load(open(metadata_file, 'r'))
    except ValueError:
        pytest.fail('Metadata file contains invalid JSON')

    ok = isinstance(metadata, dict) and isinstance(metadata['files'], list)
    assert ok, 'Metadata should be an object containing a "files" array'

    ok = all(isinstance(f, dict) for f in metadata['files'])
    assert ok, 'All project metadata files should be JSON objects'

    for file in metadata['files']:
        path = file.pop('path', None)

        ok = isinstance(path, str)
        assert ok, 'Every file should have a "path" key with a string value'

        ok = 'filename' not in path or '/' not in path['filename']
        assert ok, 'When filename is present, it should not contain slashes'

        content_path = INITIAL_PROJECT_PATH / path
        ok = isfile(content_path) and access(content_path, R_OK)
        assert ok, f'"{content_path}" should be an existing, readable file'

        try:
            Files(**file)
        except TypeError as e:
            pytest.fail(f'Project file metadata contains an invalid key: {e}')
