import pytest
from neo4japp.models.auth import (
    AccessControlPolicy,
    AppRole,
    AppUser,
)
from neo4japp.models.projects import (
    Projects,
    projects_collaborator_role,
)


@pytest.mark.parametrize('project_name', [
    ('test-project'),
    ('project1'),
])
def test_can_add_projects(session, project_name):
    project = Projects(
        project_name=project_name,
        description='description',
        users=[],
    )
    session.add(project)
    session.flush()

    proj = Projects.query.filter_by(project_name=project_name).one()
    assert project.project_name == project_name


@pytest.mark.parametrize('project_name, user_fks', [
    ('test-project', [1, 2, 3]),
    ('project1', [100, 200, 300]),
])
def test_can_add_users_to_projects(session, project_name, user_fks):
    project = Projects(
        project_name=project_name,
        description='description',
        users=[],
    )
    session.add(project)
    session.flush()

    proj = Projects.query.filter_by(project_name=project_name).one()

    assert len(project.users) == 0

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
    )
    session.add(test_user)
    session.flush()

    new_projects = Projects(
        project_name='they-see-me',
        description='rolling',
        users=[],
    )

    session.add(new_projects)
    session.flush()

    # NOTE: This already exists since there's an event
    # that creates roles anytime a "Projects" is created.
    # "fixed_projects" creates a "Projects"
    # @event.listens_for(Projects, 'after_insert')
    app_role = AppRole.query.filter(AppRole.name == role).one()

    session.execute(
        projects_collaborator_role.insert(),
        [dict(
            appuser_id=test_user.id,
            app_role_id=app_role.id,
            projects_id=new_projects.id,
        )]
    )
    session.flush()

    user_role = Projects.query_project_roles(
        test_user.id, new_projects.id
    ).one_or_none()

    assert user_role.name == role


def test_projects_init_with_roles(session):

    p = Projects(
        project_name='they-see-me',
        description='rolling',
        users=[],
    )
    session.add(p)
    session.flush()

    acp_roles = session.query(
        AccessControlPolicy.id,
        AppRole.name,
    ).filter(
        AccessControlPolicy.principal_type == AppRole.__tablename__,
    ).filter(
        AccessControlPolicy.asset_type == Projects.__tablename__,
        AccessControlPolicy.asset_id == p.id,
    ).join(
        AppRole,
        AppRole.id == AccessControlPolicy.principal_id,
    ).all()

    roles = [role for _, role in acp_roles]
    assert 'project-admin' in roles
    assert 'project-read' in roles
    assert 'project-write' in roles
