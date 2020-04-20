import pytest
from neo4japp.models import Projects


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

    project.users = user_fks

    session.flush()

    assert len(project.users) == len(user_fks)
