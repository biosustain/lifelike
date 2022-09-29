import pytest

from neo4japp.models import Files
from neo4japp.models.auth import (
    AppRole,
    AppUser,
)
from neo4japp.models.projects import (
    Projects,
    projects_collaborator_role,
)
from neo4japp.services.file_types.providers import DirectoryTypeProvider


@pytest.mark.parametrize('name', [
    ('!nva!d|'),
    ('i3cr3e@m>i4cr4e@m'),
    ('   style    '),
])
def test_flag_invalid_projects_name(session, name):
    with pytest.raises(ValueError):
        project = Projects(
            name=name,
            description='description',
        )


@pytest.mark.parametrize('name', [
    ('test-project'),
    ('p r o j e c t 1'),
    ('valid_underscore'),
    ('ö-german'),
    ('æØÅ_nordic#letters$are@valid')
])
def test_can_add_projects(session, name, test_user):
    ***ARANGO_USERNAME***_dir = Files(
        mime_type=DirectoryTypeProvider.MIME_TYPE,
        filename='/',
        path=f'/{name}',
        user=test_user,
    )
    project = Projects(
        name=name,
        description='description',
        ***ARANGO_USERNAME***=***ARANGO_USERNAME***_dir,
    )
    session.add(***ARANGO_USERNAME***_dir)
    session.add(project)
    session.flush()

    proj = Projects.query.filter_by(name=name).one()
    assert project.name == name


@pytest.mark.parametrize('name, user_fks', [
    ('test-project', [1, 2, 3]),
    ('project1', [100, 200, 300]),
])
def test_can_add_users_to_projects(session, name, user_fks, test_user: AppUser):
    ***ARANGO_USERNAME***_dir = Files(
        mime_type=DirectoryTypeProvider.MIME_TYPE,
        filename='/',
        path=f'/{name}',
        user=test_user,
    )
    project = Projects(
        name=name,
        description='description',
        ***ARANGO_USERNAME***=***ARANGO_USERNAME***_dir,
    )
    session.add(***ARANGO_USERNAME***_dir)
    session.add(project)
    session.flush()

    proj = Projects.query.filter_by(name=name).one()

    proj.users = user_fks

    session.flush()

    assert len(proj.users) == len(user_fks)


@pytest.mark.parametrize('role', [
    'project-admin',
    'project-read',
    'project-write',
])
def test_can_set_user_role(session, role):

    test_user = AppUser(
        username='test',
        email='test@***ARANGO_DB_NAME***.bio',
        password_hash='pw',
        first_name='test',
        last_name='tester',
        subject='test@***ARANGO_DB_NAME***.bio',
    )
    session.add(test_user)
    session.flush()

    ***ARANGO_USERNAME***_dir = Files(
        mime_type=DirectoryTypeProvider.MIME_TYPE,
        filename='/',
        path='/they-see-me',
        user=test_user,
    )
    new_projects = Projects(
        name='they-see-me',
        description='rolling',
        ***ARANGO_USERNAME***=***ARANGO_USERNAME***_dir,
    )

    session.add(***ARANGO_USERNAME***_dir)
    session.add(new_projects)
    session.flush()

    # NOTE: This already exists since there's an event
    # that creates roles anytime a "Projects" is created.
    # "fixed_projects" creates a "Projects"
    # @event.listens_for(Projects, 'after_insert')
    app_role = AppRole.query.filter(AppRole.name == role).one()

    session.execute(
        projects_collaborator_role.insert(),
        [{
            'appuser_id': test_user.id,
            'app_role_id': app_role.id,
            'projects_id': new_projects.id,
        }]
    )
    session.flush()

    user_role = Projects.query_project_roles(
        test_user.id, new_projects.id
    ).one_or_none()

    assert user_role.name == role


def test_projects_init_with_roles(session, test_user: AppUser):

    ***ARANGO_USERNAME***_dir = Files(
        mime_type=DirectoryTypeProvider.MIME_TYPE,
        filename='/',
        path='/they-see-me',
        user=test_user,
    )
    p = Projects(
        name='they-see-me',
        description='rolling',
        ***ARANGO_USERNAME***=***ARANGO_USERNAME***_dir,
    )
    session.add(***ARANGO_USERNAME***_dir)
    session.add(p)
    session.flush()

    acp_roles = session.query(
        AppRole.name,
    ).all()

    roles = [role for role, in acp_roles]
    assert 'project-admin' in roles
    assert 'project-read' in roles
    assert 'project-write' in roles
