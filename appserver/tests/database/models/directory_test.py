import pytest
from neo4japp.models import Directory, Projects


@pytest.fixture(scope='function')
def project(session):
    p = Projects(project_name='test-project', description='test project', users=[])
    session.add(p)
    session.flush()
    return p


def test_can_get_child_directories(session, project):
    parent_dir = Directory(name='parent', directory_parent_id=None, projects_id=project.id)
    session.add(parent_dir)
    session.flush()

    child_dir = Directory(name='child-1', directory_parent_id=parent_dir.id, projects_id=project.id)
    session.add(child_dir)
    session.flush()

    child_dir2 = Directory(name='child-2', directory_parent_id=child_dir.id, projects_id=project.id)
    session.add(child_dir2)
    session.flush()

    query = Directory.query_child_directories(parent_dir.id)
    directories = [d.name for d in session.query(query).all()]

    assert ['parent', 'child-1', 'child-2'] == directories
