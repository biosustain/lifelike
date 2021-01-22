from collections import namedtuple

import pytest

from neo4japp.models import AppUser, Projects, projects_collaborator_role, Files, FileContent
from neo4japp.services import AccountService
from neo4japp.services.file_types.providers import DirectoryTypeProvider, MapTypeProvider


@pytest.fixture(scope='function')
def login_password() -> str:
    return 'some password'


@pytest.fixture(scope='function')
def project_owner_user(
        request,
        session,
        account_user: AccountService,
        login_password: str) -> AppUser:
    user = AppUser(
        username='project owner',
        email=f'somebody@***ARANGO_DB_NAME***.bio',
        first_name='joe',
        last_name='taylor',
    )
    user.set_password(login_password)
    session.add(user)
    session.flush()
    return user


@pytest.fixture(scope='function')
def project(
        session,
        project_owner_user: AppUser) -> Projects:
    ***ARANGO_USERNAME***_dir = Files(
        mime_type=DirectoryTypeProvider.MIME_TYPE,
        filename='/',
        user=project_owner_user,
    )
    project = Projects(
        name='my-life-work',
        description='random stuff',
        ***ARANGO_USERNAME***=***ARANGO_USERNAME***_dir,
    )
    session.add(***ARANGO_USERNAME***_dir)
    session.add(project)
    session.flush()
    return project


ParameterizedAppUser = namedtuple('UserParam', (
    'app_roles',
    'project_roles',
), defaults=([], []))


@pytest.fixture(scope='function')
def user_with_project_roles(
        request,
        session,
        account_user: AccountService,
        login_password: str,
        project: Projects) -> AppUser:
    if hasattr(request, 'param'):
        param: ParameterizedAppUser = request.param
    else:
        param = ParameterizedAppUser([], [])

    user = AppUser(
        username='user_with_project_roles',
        email=f'somehow@***ARANGO_DB_NAME***.bio',
        first_name='erica',
        last_name='samuel',
    )
    user.set_password(login_password)
    user.roles.extend([account_user.get_or_create_role(role_name)
                       for role_name in param.app_roles])
    session.add(user)
    session.flush()

    for role_name in param.project_roles:
        session.execute(
            projects_collaborator_role.insert(),
            [{
                'appuser_id': user.id,
                'app_role_id': account_user.get_or_create_role(role_name).id,
                'projects_id': project.id,
            }]
        )
    session.flush()
    return user


ParameterizedFile = namedtuple('FilesParam', (
    'public',
), defaults=(False,))


@pytest.fixture(scope='function')
def folder_in_project(
        request,
        session,
        project: Projects,
        project_owner_user: AppUser) -> Files:
    file = Files(
        mime_type=DirectoryTypeProvider.MIME_TYPE,
        filename='a folder',
        description='desc',
        user=project_owner_user,
        parent=project.***ARANGO_USERNAME***,
    )

    if hasattr(request, 'param'):
        param: ParameterizedFile = request.param
        file.public = param.public

    session.add(file)
    session.flush()
    return file


@pytest.fixture(scope='function')
def map_in_project(
        request,
        session,
        project: Projects,
        folder_in_project: Files,
        project_owner_user: AppUser) -> Files:
    content = FileContent()
    content.raw_file_utf8 = '{}'

    file = Files(
        mime_type=MapTypeProvider.MIME_TYPE,
        filename='a map',
        description='desc',
        user=project_owner_user,
        content=content,
        parent=folder_in_project,
    )

    if hasattr(request, 'param'):
        param: ParameterizedFile = request.param
        file.public = param.public

    session.add(content)
    session.add(file)
    session.flush()
    return file
