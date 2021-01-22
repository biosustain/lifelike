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
        email=f'somebody@lifelike.bio',
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
    root_dir = Files(
        mime_type=DirectoryTypeProvider.MIME_TYPE,
        filename='/',
        user=project_owner_user,
    )
    project = Projects(
        name='my-life-work',
        description='random stuff',
        root=root_dir,
    )
    session.add(root_dir)
    session.add(project)
    session.flush()
    return project


@pytest.fixture(scope='function')
def user_with_project_roles(
        request,
        session,
        account_user: AccountService,
        login_password: str,
        project: Projects) -> AppUser:
    user = AppUser(
        username='user_with_project_roles',
        email=f'somehow@lifelike.bio',
        first_name='erica',
        last_name='samuel',
    )
    user.set_password(login_password)
    user.roles.extend([account_user.get_or_create_role(role_name)
                       for role_name in request.param[0]])
    session.add(user)
    session.flush()

    for role_name in request.param[1]:
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


@pytest.fixture(scope='function')
def map_in_project(
        request,
        session,
        project: Projects,
        project_owner_user: AppUser) -> Files:
    content = FileContent()
    content.raw_file_utf8 = '{}'

    file = Files(
        mime_type=MapTypeProvider.MIME_TYPE,
        filename='a map',
        description='desc',
        user=project_owner_user,
        content=content,
        parent=project.root,
        **request.param,
    )
    session.add(content)
    session.add(file)
    session.flush()
    return file
