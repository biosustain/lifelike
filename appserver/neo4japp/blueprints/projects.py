from flask import (
    current_app,
    request,
    jsonify,
    Blueprint,
    g,
    abort,
)
from neo4japp.blueprints.auth import auth
from neo4japp.blueprints.permissions import requires_project_role, requires_project_permission
from neo4japp.database import db, get_projects_service
from neo4japp.data_transfer_objects import DirectoryContent
from neo4japp.exceptions import RecordNotFoundException, NotAuthorizedException, DuplicateRecord
from neo4japp.models import (
    AccessActionType,
    AppRole,
    AppUser,
    Directory,
    Projects,
    projects_collaborator_role,
)
from neo4japp.services.exceptions import NameUnavailableError

bp = Blueprint('projects', __name__, url_prefix='/projects')


@bp.route('/<name>', methods=['GET'])
@auth.login_required
def get_project(name):
    # TODO: Add permission checks here
    user = g.current_user
    projects = Projects.query.filter(Projects.project_name == name).one_or_none()
    if projects is None:
        raise RecordNotFoundException(f'Project {name} not found')

    # Pull up directory id for project
    proj_service = get_projects_service()
    dir = proj_service.get_root_dir(projects)

    # Combine both dictionaries
    results = {
        **projects.to_dict(),
        "directory": dir.to_dict()
    }
    return jsonify(dict(results=results)), 200


@bp.route('/', methods=['GET'])
@auth.login_required
def get_projects():
    # TODO: Add permission checks here
    user = g.current_user

    proj_service = get_projects_service()
    projects_list = proj_service.projects_users_have_access_2(user)
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

    current_app.logger.info(
        f'User created projects: <{g.current_user.email}:{projects.project_name}>')

    proj_service = get_projects_service()
    try:
        proj_service.create_projects(user, projects)
    except NameUnavailableError:
        raise DuplicateRecord('There is a project with that name already.')
    return jsonify(dict(results=projects.to_dict())), 200


@bp.route('/<string:project_name>/collaborators', methods=['GET'])
@auth.login_required
@requires_project_permission(AccessActionType.READ)
def get_project_collaborators(project_name: str = ''):
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
def add_collaborator(username: str, project_name: str = ''):

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

    # If new collaborator and user are the same, throw error
    if new_collaborator.id == user.id:
        raise NotAuthorizedException(f'You\'re already admin. Why downgrade? ¯\\_(ツ)_/¯')

    new_role = AppRole.query.filter(AppRole.name == project_role).one()
    proj_service.add_collaborator(new_collaborator, new_role, projects)

    yield jsonify(dict(result='success')), 200


@bp.route('/<string:project_name>/collaborators/<string:username>', methods=['PUT'])
@auth.login_required
@requires_project_role('project-admin')
def edit_collaborator(username: str, project_name: str):

    proj_service = get_projects_service()

    data = request.get_json()

    project_role = data['role']

    projects = Projects.query.filter(
        Projects.project_name == project_name
    ).one_or_none()

    if projects is None:
        raise RecordNotFoundException(f'No such projects: {project_name}')

    user = g.current_user

    yield user, projects

    new_collaborator = AppUser.query.filter(
        AppUser.username == username
    ).one_or_none()

    if new_collaborator is None:
        raise RecordNotFoundException(f'No such username {username}')

    new_role = AppRole.query.filter(AppRole.name == project_role).one()
    proj_service.edit_collaborator(new_collaborator, new_role, projects)

    yield jsonify(dict(result='success')), 200


@bp.route('/<string:project_name>/collaborators/<string:username>', methods=['DELETE'])
@auth.login_required
@requires_project_role('project-admin')
def remove_collaborator(username: str, project_name: str = ''):

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
def get_top_level_directories(project_name: str = ''):
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
    contents = DirectoryContent(
        child_directories=[c.to_dict() for c in child_dirs],
        files=[f.to_dict() for f in root_dir.files],
        maps=[m.to_dict() for m in root_dir.project],
    )
    yield jsonify(dict(result=contents.to_dict()))


@bp.route('/<string:project_name>/directories', methods=['POST'])
@auth.login_required
@requires_project_permission(AccessActionType.WRITE)
def add_directory(project_name: str = ''):
    proj_service = get_projects_service()
    projects = Projects.query.filter(
        Projects.project_name == project_name
    ).one_or_none()

    if projects is None:
        raise RecordNotFoundException(f'No such projects: {project_name}')

    data = request.get_json()
    dir_name = data['dirname']

    parent_dir = data.get('parentDir', None)
    parent_dir = Directory.query.get(parent_dir)

    user = g.current_user

    yield user, projects
    new_dir = proj_service.add_directory(projects, dir_name, parent_dir)
    yield jsonify(dict(results=new_dir.to_dict()))


@bp.route('/<string:project_name>/directories/<int:current_dir_id>', methods=['GET'])
@auth.login_required
@requires_project_permission(AccessActionType.READ)
def get_child_directories(current_dir_id: int, project_name: str = ''):
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
    contents = DirectoryContent(
        child_directories=[c.to_dict() for c in child_dirs],
        files=[f.to_dict() for f in current_dir.files],
        maps=[m.to_dict() for m in current_dir.project],
    )
    yield jsonify(dict(result=contents.to_dict()))
