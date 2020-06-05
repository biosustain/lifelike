import pytest
import json
from sqlalchemy import and_
from neo4japp.models import (
    AppUser,
    AppRole,
    Projects,
    projects_collaborator_role,
    Directory
)


def generate_headers(jwt_token):
    return {'Authorization': f'Bearer {jwt_token}'}


def test_can_add_projects(client, session, test_user):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])
    response = client.post(
        '/projects/',
        data=json.dumps({
            'projectName': 'test',
            'description': 'test project',
            'users': [test_user.id],
        }),
        headers=headers,
        content_type='application/json'
    )

    assert response.status_code == 200
    response_json = response.get_json()['results']
    ***ARANGO_USERNAME***_dir = session.query(Directory).filter(
        and_(
            Directory.name == '/',
            Directory.projects_id == response_json['id'],
            Directory.directory_parent_id.is_(None),
        )
    ).one_or_none()
    assert ***ARANGO_USERNAME***_dir


def test_can_get_project(client, fix_project, test_user):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])
    response = client.get('/projects/Lifelike', headers=headers)
    assert response.status_code == 200
    response_data = response.get_json()['results']
    assert response_data['projectName'] == fix_project.project_name


def test_can_get_list_of_projects(client, session, test_user):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])

    for i in range(2):
        projects = Projects(project_name=f'project-{i}', description='', users=[])
        session.add(projects)
        session.flush()

    response = client.get('/projects/', headers=headers)
    assert response.status_code == 200
    response_data = response.get_json()['results']
    projects_count = Projects.query.count()
    assert projects_count != 0
    assert len(response_data) == projects_count


@pytest.mark.parametrize('username, email, expected_status', [
    ('test', 'test@***ARANGO_DB_NAME***.bio', 200),
    ('pleb', 'pleblife@hut.org', 400),
])
def test_only_admins_can_add_collaborators(
        client, session, fix_project, test_user, test_user_2, username, email, expected_status):

    login_resp = client.login_as_user(email, 'password')
    headers = generate_headers(login_resp['access_jwt'])

    response = client.post(
        f'/projects/{fix_project.project_name}/collaborators/{username}',
        data=json.dumps({'role': 'project-read'}),
        headers=headers,
        content_type='application/json',
    )

    assert response.status_code == expected_status


@pytest.mark.parametrize('username, email, expected_status', [
    ('test', 'test@***ARANGO_DB_NAME***.bio', 200),
    ('pleb', 'pleblife@hut.org', 400),
])
def test_only_admins_can_remove_collaborators(
        client, session, fix_project, test_user, test_user_2, username, email, expected_status):

    login_resp = client.login_as_user(email, 'password')
    headers = generate_headers(login_resp['access_jwt'])

    response = client.delete(
        f'/projects/{fix_project.project_name}/collaborators/{username}',
        headers=headers,
        content_type='application/json',
    )

    assert response.status_code == expected_status


def test_can_get_collaborators(client, session, fix_project, test_user):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])

    response = client.get(
        f'/projects/{fix_project.project_name}/collaborators',
        headers=headers,
        content_type='application/json',
    )

    assert response.status_code == 200

    data = response.get_json()['results']
    collaborators = [c['username'] for c in data]
    assert test_user.username in collaborators


def test_noncollaborators_cannot_view(client, session, fix_project, test_user_2):
    login_resp = client.login_as_user(test_user_2.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])

    response = client.get(
        f'/projects/{fix_project.project_name}/collaborators',
        headers=headers,
        content_type='application/json',
    )

    assert response.status_code == 400
