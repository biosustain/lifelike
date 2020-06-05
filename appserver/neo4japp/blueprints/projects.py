from flask import request, jsonify, Blueprint, g, abort
from neo4japp.blueprints.auth import auth
from neo4japp.blueprints.permissions import requires_project_role, requires_project_permission
from neo4japp.database import db, get_projects_service
from neo4japp.exceptions import RecordNotFoundException, NotAuthorizedException
from neo4japp.models import (
    AccessActionType,
    AppRole,
    AppUser,
    Directory,
    Projects,
    projects_collaborator_role,
)

bp = Blueprint('projects', __name__, url_prefix='/projects')


@bp.route('/<name>', methods=['GET'])
@auth.login_required
def get_project(name):
    # TODO: Add permission checks here
    user = g.current_user
    projects = Projects.query.filter(Projects.project_name == name).one_or_none()
    if projects is None:
        raise RecordNotFoundException(f'Project {name} not found')

    return jsonify(dict(results=projects.to_dict())), 200


@bp.route('/', methods=['GET'])
@auth.login_required
def get_projects():
    # TODO: Add permission checks here
    user = g.current_user
    projects_list = db.session.query(Projects).all()  # TODO: paginate
    return jsonify(dict(results=[p.to_dict() for p in projects_list])), 200


@bp.route('/', methods=['POST'])
@auth.login_required
def add_projects():

    data = request.get_json()
    user = g.current_user

    projects = Projects(
        project_name=data['projectName'],
        description=data['description'],
        users=[user.id],  # TODO: deprecate once migration is complete
    )

    proj_service = get_projects_service()
    proj_service.create_projects(user, projects)
    return jsonify(dict(results=projects.to_dict())), 200


@bp.route('/<string:project_name>/collaborators', methods=['GET'])
@auth.login_required
@requires_project_permission(AccessActionType.READ)
def get_project_collaborators(project_name: str):
    proj_service = get_projects_service()

    projects = Projects.query.filter(
        Projects.project_name == project_name
    ).one_or_none()

    if projects is None:
        raise RecordNotFoundException(f'No such projects: {project_name}')

    user = g.current_user

    yield user, projects

    collaborators = db.session.query(
        AppUser.id,
        AppUser.username,
        AppRole.name,
    ).filter(
        AppUser.id == user.id
    ).join(
        projects_collaborator_role,
        projects_collaborator_role.c.appuser_id == AppUser.id
    ).join(
        Projects
    ).filter(
        Projects.id == projects.id
    ).join(
        AppRole
    ).all()  # TODO: paginate

    yield jsonify(dict(results=[{
        'id': id,
        'username': username,
        'role': role,
    } for id, username, role in collaborators])), 200


@bp.route('/<string:project_name>/collaborators/<string:username>', methods=['POST'])
@auth.login_required
@requires_project_role('project-admin')
def add_collaborator(project_name: str, username: str):

    proj_service = get_projects_service()

    data = request.get_json()

    project_role = data['role']

    projects = Projects.query.filter(
        Projects.project_name == project_name
    ).one_or_none()

    if projects is None:
        raise RecordNotFoundException(f'No such projects: {project_name}')

    new_collaborator = AppUser.query.filter(
        AppUser.username == username
    ).one_or_none()

    if new_collaborator is None:
        raise RecordNotFoundException(f'No such username {username}')

    user = g.current_user

    yield user, projects

    new_role = AppRole.query.filter(AppRole.name == project_role).one()
    proj_service.add_collaborator(new_collaborator, new_role, projects)

    yield jsonify(dict(result='success')), 200


@bp.route('/<string:project_name>/collaborators/<string:username>', methods=['DELETE'])
@auth.login_required
@requires_project_role('project-admin')
def remove_collaborator(project_name: str, username: str):

    proj_service = get_projects_service()

    user = g.current_user

    projects = Projects.query.filter(
        Projects.project_name == project_name
    ).one_or_none()

    if projects is None:
        raise RecordNotFoundException(f'No such projects: {project_name}')

    new_collaborator = AppUser.query.filter(
        AppUser.username == username
    ).one_or_none()

    user = g.current_user

    yield user, projects

    proj_service.remove_collaborator(new_collaborator, projects)

    yield jsonify(dict(result='success')), 200


@bp.route('/<string:project_name>/directories', methods=['GET'])
@auth.login_required
@requires_project_permission(AccessActionType.READ)
def get_top_level_directories(project_name: str):
    proj_service = get_projects_service()
    projects = Projects.query.filter(
        Projects.project_name == project_name
    ).one_or_none()

    if projects is None:
        raise RecordNotFoundException(f'No such projects: {project_name}')

    user = g.current_user

    yield user, projects
    root_dir = proj_service.get_root_dir(projects)
    child_dirs = proj_service.get_immediate_child_dirs(projects, root_dir)
    yield jsonify(dict(results=[d.to_dict() for d in child_dirs]))


@bp.route('/<string:project_name>/directories', methods=['POST'])
@auth.login_required
@requires_project_permission(AccessActionType.WRITE)
def add_directory(project_name: str):
    proj_service = get_projects_service()
    projects = Projects.query.filter(
        Projects.project_name == project_name
    ).one_or_none()

    if projects is None:
        raise RecordNotFoundException(f'No such projects: {project_name}')

    data = request.get_json()
    dir_name = data['dirname']

    user = g.current_user

    yield user, projects
    new_dir = proj_service.add_directory(projects, dir_name)
    yield jsonify(dict(results=new_dir.to_dict()))


@bp.route('/<string:project_name>/directories/<int:current_dir_id>', methods=['GET'])
@auth.login_required
@requires_project_permission(AccessActionType.READ)
def get_child_directories(project_name: str, current_dir_id: int):
    """ Used similar to a 'next' function """
    proj_service = get_projects_service()
    projects = Projects.query.filter(
        Projects.project_name == project_name
    ).one_or_none()

    if projects is None:
        raise RecordNotFoundException(f'No such projects: {project_name}')

    user = g.current_user

    yield user, projects
    current_dir = Directory.query.get(current_dir_id)
    child_dirs = proj_service.get_immediate_child_dirs(projects, current_dir)
    yield jsonify(dict(results=[d.to_dict() for d in child_dirs]))
