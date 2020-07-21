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
    root_dir = session.query(Directory).filter(
        and_(
            Directory.name == '/',
            Directory.projects_id == response_json['id'],
            Directory.directory_parent_id.is_(None),
        )
    ).one_or_none()
    assert root_dir


def test_can_get_project(client, fix_project, fix_directory, test_user):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])
    response = client.get('/projects/Lifelike', headers=headers)
    assert response.status_code == 200
    response_data = response.get_json()['results']
    assert response_data['projectName'] == fix_project.project_name


def test_can_get_list_of_projects(client, session, test_user):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])

    number_of_projects_made_by_test_user = 2

    for i in range(
        number_of_projects_made_by_test_user
    ):
        projects = Projects(
            project_name=f'project-{i}',
            description='',
            users=[test_user.id]
        )
        session.add(projects)
        session.flush()

        default_dir = Directory(
            name='/',
            directory_parent_id=None,
            projects_id=projects.id
        )
        session.add(default_dir)
        session.flush()

        role = AppRole.query.filter(
            AppRole.name == 'project-admin'
        ).one()
        session.execute(
            projects_collaborator_role.insert(),
            [dict(
                appuser_id=test_user.id,
                app_role_id=role.id,
                projects_id=projects.id,
            )]
        )
        session.flush()

    response = client.get('/projects/', headers=headers)
    assert response.status_code == 200
    response_data = response.get_json()['results']
    assert len(response_data) == number_of_projects_made_by_test_user


@pytest.mark.parametrize('username, email, expected_status', [
    ('test', 'test@lifelike.bio', 400),
    ('pleb', 'pleblife@hut.org', 200),
])
def test_only_admins_can_add_collaborators_and_not_themselves(
        client, session, fix_project, test_user, test_user_2, username, email, expected_status):

    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])

    response = client.post(
        f'/projects/{fix_project.project_name}/collaborators/{username}',
        data=json.dumps({'role': 'project-read'}),
        headers=headers,
        content_type='application/json',
    )

    assert response.status_code == expected_status


@pytest.mark.parametrize('username, email, expected_status', [
    ('test', 'test@lifelike.bio', 200),
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


def test_can_add_directory(client, session, fix_project, fix_directory, test_user):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])

    response = client.post(
        f'/projects/{fix_project.project_name}/directories',
        data=json.dumps(dict(
            dirname='new-dir',
            parentDir=fix_directory.id
        )),
        headers=headers,
        content_type='application/json',
    )

    assert response.status_code == 200


def test_can_rename_directory(client, session, fix_project, fix_directory, test_user):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])

    new_dir = Directory(
        name='bobsled',
        directory_parent_id=fix_directory.id,
        projects_id=fix_project.id,
    )
    session.add(new_dir)
    session.flush()

    response = client.post(
        f'/projects/{fix_project.project_name}/directories/{new_dir.id}/rename',
        data=json.dumps(dict(name='sledbob')),
        headers=headers,
        content_type='application/json',
    )

    assert response.status_code == 200
    result = response.get_json()['result']
    assert result['name'] == 'sledbob'


def test_can_delete_directory(client, session, fix_project, fix_directory, test_user):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])

    new_dir = Directory(
        name='bobsled',
        directory_parent_id=fix_directory.id,
        projects_id=fix_project.id,
    )
    session.add(new_dir)
    session.flush()

    response = client.post(
        f'/projects/{fix_project.project_name}/directories/{new_dir.id}/delete',
        data=json.dumps(dict(dir_id=new_dir.id)),
        headers=headers,
        content_type='application/json',
    )

    assert response.status_code == 200


def test_can_move_directory(client, session, fix_project, fix_directory, test_user):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])

    nested_dir = Directory(
        name='child-1',
        directory_parent_id=fix_directory.id,
        projects_id=fix_project.id,
    )
    session.add(nested_dir)
    session.flush()

    nested_dir_2 = Directory(
        name='child-2',
        directory_parent_id=nested_dir.id,
        projects_id=fix_project.id,
    )

    session.add(nested_dir_2)
    session.flush()

    response = client.post(
        f'/projects/{fix_project.project_name}/directories/move',
        data=json.dumps(dict(
            asset_id=nested_dir_2.id,
            dest_dir_id=fix_directory.id,
            asset_type='dir'
        )),
        headers=headers,
        content_type='application/json',
    )

    assert response.status_code == 200
    result = response.get_json()['result']
    assert result['dest']['id'] == fix_directory.id
