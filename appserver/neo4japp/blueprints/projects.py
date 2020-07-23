import re
from flask import (
    current_app,
    request,
    jsonify,
    Blueprint,
    g,
    abort,
)
from sqlalchemy import and_
from neo4japp.blueprints.auth import auth
from neo4japp.blueprints.permissions import requires_project_role, requires_project_permission
from neo4japp.database import db, get_projects_service
from neo4japp.data_transfer_objects import (
    DirectoryContent,
    DirectoryRenameRequest,
    FileType,
    MoveFileRequest,
    MoveFileResponse,
)
from neo4japp.exceptions import (
    DirectoryError,
    DuplicateRecord,
    InvalidDirectoryNameException,
    RecordNotFoundException,
    NotAuthorizedException,
)
from neo4japp.models import (
    AccessActionType,
    AppRole,
    AppUser,
    Files,
    Directory,
    Project,
    Projects,
    projects_collaborator_role, ProjectSchema,
)
from neo4japp.util import jsonify_with_class, SuccessResponse, CasePreservedDict

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
    dir = proj_service.get_***ARANGO_USERNAME***_dir(projects)

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

    if not re.match('^[A-Za-z0-9-]{1,50}$', data['projectName']):
        raise ValueError('incorrect project name format')

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
def add_collaborator(username: str, project_name: str):
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
def remove_collaborator(username: str, project_name: str):
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

    parent_dir = data.get('parentDir', None)
    parent_dir = Directory.query.get(parent_dir)

    user = g.current_user

    yield user, projects
    new_dir = proj_service.add_directory(projects, dir_name, user, parent_dir)
    yield jsonify(dict(results=new_dir.to_dict()))


@bp.route('/<string:project_name>/directories/move', methods=['POST'])
@jsonify_with_class(MoveFileRequest)
@auth.login_required
@requires_project_permission(AccessActionType.WRITE)
def move_files(req: MoveFileRequest, project_name: str):
    project_service = get_projects_service()
    projects = Projects.query.filter(
        Projects.project_name == project_name
    ).one_or_none()

    if projects is None:
        raise RecordNotFoundException(f'No such projects: {project_name}')

    user = g.current_user

    yield user, projects

    dest_dir = Directory.query.filter(
        Directory.id == req.dest_dir_id
    ).one_or_none()

    if dest_dir is None:
        raise RecordNotFoundException(f'No such directory')

    if req.asset_type == FileType.PDF:
        asset = Files.query.filter(Files.id == req.asset_id).one_or_none()
        if asset is None:
            raise RecordNotFoundException(f'No such file found')
        dest = project_service.move_pdf(asset, dest_dir)
    elif req.asset_type == FileType.MAP:
        asset = Project.query.filter(Project.id == req.asset_id).one_or_none()
        if asset is None:
            raise RecordNotFoundException(f'No such drawing map (project) found')
        dest = project_service.move_map(asset, dest_dir)
    elif req.asset_type == FileType.DIR:
        asset = Directory.query.filter(Directory.id == req.asset_id).one_or_none()
        if asset is None:
            raise RecordNotFoundException(f'No such directory found')
        dest = project_service.move_directory(asset, dest_dir)
    else:
        raise DirectoryError('No asset type defined for move operation')

    yield SuccessResponse(
        result=MoveFileResponse(
            dest=dest.to_dict(),
            asset=asset.to_dict()
        ), status_code=200)


@bp.route('/<string:project_name>/directories/<int:current_dir_id>/rename', methods=['POST'])
@auth.login_required
@jsonify_with_class(DirectoryRenameRequest)
@requires_project_permission(AccessActionType.WRITE)
def rename_directory(req: DirectoryRenameRequest, current_dir_id: int, project_name: str):
    proj_service = get_projects_service()
    projects = Projects.query.filter(
        Projects.project_name == project_name
    ).one_or_none()

    if projects is None:
        raise RecordNotFoundException(f'No such projects: {project_name}')

    user = g.current_user

    yield user, projects

    dir = Directory.query.filter(
        and_(
            Directory.id == current_dir_id,
            Projects.id == projects.id,
        )
    ).one_or_none()

    if dir is None:
        raise RecordNotFoundException(f'No directory found')

    pattern = re.compile(r'\s*')
    if pattern.sub('', req.name) == '':
        raise InvalidDirectoryNameException('Directory cannot be empty')

    modified_dir = proj_service.rename_directory(req.name, dir)

    yield SuccessResponse(result=modified_dir.to_dict(), status_code=200)


@bp.route('/<string:project_name>/directories/<int:current_dir_id>/delete', methods=['POST'])
@auth.login_required
@requires_project_permission(AccessActionType.WRITE)
def delete_directory(current_dir_id: int, project_name: str):
    proj_service = get_projects_service()
    projects = Projects.query.filter(
        Projects.project_name == project_name
    ).one_or_none()

    if projects is None:
        raise RecordNotFoundException(f'No such projects: {project_name}')

    user = g.current_user

    yield user, projects

    dir = Directory.query.filter(
        and_(
            Directory.id == current_dir_id,
            Projects.id == projects.id,
        )
    ).one_or_none()

    if dir is None:
        raise RecordNotFoundException(f'No directory found')

    proj_service.delete_directory(dir)

    yield jsonify(result='successful deleted', status_code=200)


@bp.route('/<string:project_name>/directories', methods=['GET'], defaults={'current_dir_id': None})
@bp.route('/<string:project_name>/directories/<int:current_dir_id>', methods=['GET'])
@auth.login_required
@requires_project_permission(AccessActionType.READ)
def get_child_directories(current_dir_id: int, project_name: str):
    """ Used similar to a 'next' function """
    proj_service = get_projects_service()
    projects = Projects.query.filter(
        Projects.project_name == project_name
    ).one_or_none()

    if projects is None:
        raise RecordNotFoundException(f'No such projects: {project_name}')

    user = g.current_user

    yield user, projects

    if current_dir_id:
        dir = Directory.query.get(current_dir_id)
    else:
        dir = proj_service.get_***ARANGO_USERNAME***_dir(projects)

    if dir is None:
        raise RecordNotFoundException("Directory not found")

    parents = proj_service.get_absolute_dir_path(projects, dir)
    child_dirs = proj_service.get_immediate_child_dirs(projects, dir)

    project_schema = ProjectSchema()

    contents = DirectoryContent(
        dir=dir.to_dict(),
        path=[{
            'id': d[0],
            'name': d[1],
            'directoryParentId': d[2],
            'projectsId': d[3],  # TODO: get_absolute_dir_path() should return Directory[]
        } for d in reversed(parents)],
        objects=[
            *[{
                'type': 'dir',
                'name': c.name,
                'creator': {
                    'id': c.user_id,
                    'name': AppUser.query.get(c.user_id).username
                },
                'data': c.to_dict(),
            } for c in child_dirs],
            *[{
                'type': 'file',
                'name': f.filename,
                'creator': {
                    'id': f.user_id,
                    'name': AppUser.query.get(f.user_id).username
                },
                'description': f.description,
                'data': CasePreservedDict(f.to_dict()),
            } for f in dir.files],
            *[{
                'type': 'map',
                'name': m.label,
                'creator': {
                    'id': m.user_id,
                    'name': AppUser.query.get(m.user_id).username
                },
                'description': m.description,
                'data': CasePreservedDict(project_schema.dump(m)),
            } for m in dir.project],
        ],
    )
    yield jsonify(dict(result=contents.to_dict()))
