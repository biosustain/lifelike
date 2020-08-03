import pytest
from neo4japp.models import AppUser, Directory, Projects


@pytest.fixture(scope='function')
def mock_user(session):
    a = AppUser(
        username='dirtest',
        email='dirtest@lifelike.bio',
        first_name='dir',
        last_name='ty',
        password_hash='123'
    )
    session.add(a)
    session.flush()
    return a


@pytest.fixture(scope='function')
def project(session):
    p = Projects(project_name='test-project', description='test project', users=[])
    session.add(p)
    session.flush()
    return p


@pytest.fixture(scope='function')
def mock_directory_path(session, mock_user, project):
    """ Directory structure

    parent/child-1/child-1a
    parent/child-2

    """
    parent_dir = Directory(
        name='parent',
        directory_parent_id=None,
        projects_id=project.id,
        user_id=mock_user.id,
    )
    session.add(parent_dir)
    session.flush()

    child_dir = Directory(
        name='child-1',
        directory_parent_id=parent_dir.id,
        projects_id=project.id,
        user_id=mock_user.id,
    )
    session.add(child_dir)
    session.flush()

    child_dir1a = Directory(
        name='child-1a',
        directory_parent_id=child_dir.id,
        projects_id=project.id,
        user_id=mock_user.id,
    )
    session.add(child_dir1a)
    session.flush()

    child_dir2 = Directory(
        name='child-2',
        directory_parent_id=parent_dir.id,
        projects_id=project.id,
        user_id=mock_user.id,
    )
    session.add(child_dir2)
    session.flush()

    return parent_dir, child_dir, child_dir1a, child_dir2


@pytest.mark.parametrize('current_dir, expected_children', [
    ('parent', ['parent', 'child-1', 'child-2', 'child-1a']),
    ('child-1', ['child-1', 'child-1a']),
    ('child-2', ['child-2']),
])
def test_can_get_child_directories(session, mock_directory_path, current_dir, expected_children):
    curr_dir = Directory.query.filter(Directory.name == current_dir).one()
    query = Directory.query_child_directories(curr_dir.id)
    directories = [d.name for d in session.query(query).all()]

    assert set(directories) == set(expected_children)


@pytest.mark.parametrize('current_dir, expected_path', [
    ('parent', ['parent']),
    ('child-1', ['child-1', 'parent']),
    ('child-2', ['child-2', 'parent']),
    ('child-1a', ['child-1a', 'child-1', 'parent'])
])
def test_can_get_parent_directories(session, mock_directory_path, current_dir, expected_path):
    curr_dir = Directory.query.filter(Directory.name == current_dir).one()
    query = Directory.query_absolute_dir_path(curr_dir.id)
    directories = [d.name for d in session.query(query).all()]

    assert directories == expected_path
