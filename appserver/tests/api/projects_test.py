import pytest
import json
from sqlalchemy import and_
from neo4japp.models import Projects, Directory


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
    root_dir = session.query(Directory).filter(
        and_(
            Directory.name == '/',
            Directory.projects_id == response_json['id'],
            Directory.directory_parent_id.is_(None),
        )
    ).one_or_none()
    assert root_dir


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
