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
    NameUnavailableError,
)
from neo4japp.models import (
    AccessActionType,
    AppRole,
    AppUser,
    Files,
    Directory,
    Project,
    Projects,
    projects_collaborator_role,
)
from neo4japp.models.schema import ProjectSchema
from neo4japp.util import jsonify_with_class, SuccessResponse, CasePreservedDict
from neo4japp.utils.logger import UserEventLog

bp = Blueprint('projects', __name__, url_prefix='/projects')


@bp.route('/<name>', methods=['GET'])
@auth.login_required
def get_project(name):
    user = g.current_user
    proj_service = get_projects_service()
    projects_list = proj_service.get_accessible_projects(user, Projects.project_name == name)
    if not len(projects_list):
        raise RecordNotFoundException(f'Project {name} not found')
    project = projects_list[0]

    # Pull up directory id for project
    proj_service = get_projects_service()
    dir = proj_service.get_***ARANGO_USERNAME***_dir(project)

    # Combine both dictionaries
    results = {
        **project.to_dict(),
        "directory": dir.to_dict()
    }
    return jsonify({'results': results}), 200


@bp.route('/', methods=['GET'])
@auth.login_required
def get_projects():
    user = g.current_user

    proj_service = get_projects_service()
    projects_list = proj_service.get_accessible_projects(user)
    return jsonify({'results': [p.to_dict() for p in projects_list]}), 200


@bp.route('/', methods=['POST'])
@auth.login_required
def add_projects():
    data = request.get_json()
    user = g.current_user

    if not re.match('^[A-Za-z0-9-]{1,50}$', data['projectName']):
        raise ValueError('Incorrect project name format.')

    projects = Projects(
        project_name=data['projectName'],
        description=data['description'],
        users=[user.id],  # TODO: deprecate once migration is complete
    )

    current_app.logger.info(
        f'User created projects: <{projects.project_name}>',
        extra=UserEventLog(
            username=g.current_user.username, event_type='projects create').to_dict())

    proj_service = get_projects_service()
    try:
        proj_service.create_projects(user, projects)
    except NameUnavailableError:
        raise DuplicateRecord('There is a project with that name already.')
    return jsonify({'results': projects.to_dict()}), 200


@bp.route('/<string:project_name>/collaborators', methods=['GET'])
@auth.login_required
@requires_project_permission(AccessActionType.READ)
def get_project_collaborators(project_name: str):
    projects = Projects.query.filter(
        Projects.project_name == project_name
    ).one_or_none()

    if projects is None:
        raise RecordNotFoundException(f'No such projects: {project_name}.')

    user = g.current_user

    yield user, projects

    collaborators = db.session.query(
        AppUser.id,
        AppUser.email,
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

    yield jsonify({
        'results': [{
            'id': id,
            'email': email,
            'username': username,
            'role': role,
        } for id, email, username, role in collaborators]
    }), 200


@bp.route('/<string:project_name>/collaborators/<string:email>', methods=['POST'])
@auth.login_required
@requires_project_role('project-admin')
def add_collaborator(email: str, project_name: str):
    proj_service = get_projects_service()

    data = request.get_json()

    project_role = data['role']

    projects = Projects.query.filter(
        Projects.project_name == project_name
    ).one_or_none()

    if projects is None:
        raise RecordNotFoundException(f'No such projects: {project_name}.')

    new_collaborator = AppUser.query.filter(
        AppUser.email == email
    ).one_or_none()

    if new_collaborator is None:
        raise RecordNotFoundException(f'No such email {email}.')

    user = g.current_user

    yield user, projects

    # If new collaborator and user are the same, throw error
    if new_collaborator.id == user.id:
        raise NotAuthorizedException(f'You\'re already admin. Why downgrade? ¯\\_(ツ)_/¯')

    new_role = AppRole.query.filter(AppRole.name == project_role).one()
    proj_service.add_collaborator(new_collaborator, new_role, projects)

    current_app.logger.info(
        f'Collaborator <{new_collaborator.email}> added to project <{projects.project_name}>.',  # noqa
        extra=UserEventLog(
            username=g.current_user.username,
            event_type='project collaborator'
        ).to_dict())

    yield jsonify({'result': 'success'}), 200


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

    yield jsonify({'result': 'success'}), 200


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

    yield jsonify({'result': 'success'}), 200


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
    yield jsonify({'results': new_dir.to_dict()})


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


@bp.route('/<string:project_name>/directories/<int:current_dir_id>', methods=['DELETE'])
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
        current_dir_id = dir.id

    if dir is None:
        raise RecordNotFoundException("Directory not found")

    # Pull up directory path to current dir
    parents = proj_service.get_absolute_dir_path(projects, dir)

    project_schema = ProjectSchema()

    child_dirs, files, maps = proj_service.get_dir_content(projects, dir)

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
                'id': c.id,
                'type': 'dir',
                'name': c.name,
                'creator': {
                    'id': c.user_id,
                    'username': c.username,
                },
                'project': {
                    'project_name': project_name,
                },
                'annotation_date': None,
                'creation_date': c.creation_date,
                'modification_date': c.modified_date,
                'data': c.__dict__.to_dict(snake_to_camel_transform=True),
            } for c in child_dirs],
            *[{
                'id': f.file_id,
                'type': 'file',
                'name': f.filename,
                'creator': {
                    'id': f.user_id,
                    'name': f.username,
                    'username': f.username
                },
                'project': {
                    'project_name': project_name,
                },
                'description': f.description,
                'annotation_date': f.annotations_date,
                'creation_date': f.creation_date,
                'modification_date': f.modified_date,
                'data': CasePreservedDict(f.__dict__)
            } for f in files],
            *[{
                'id': m.hash_id,
                'type': 'map',
                'name': m.label,
                'annotation_date': None,
                'creation_date': m.creation_date,
                'modification_date': m.modified_date,
                'creator': {
                    'id': m.user_id,
                    'name': m.username,
                    'username': m.username
                },
                'project': {
                    'project_name': project_name,
                },
                'description': m.description,
                'data': CasePreservedDict(m.__dict__),
            } for m in maps],
        ],
    )
    yield jsonify({'result': contents.to_dict()})
