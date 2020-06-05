from flask import request, jsonify, Blueprint, g, abort
from neo4japp.blueprints.auth import auth
from neo4japp.blueprints.permissions import requires_project_role
from neo4japp.database import db, get_projects_service
from neo4japp.exceptions import RecordNotFoundException
from neo4japp.models import (
    AppRole,
    AppUser,
    Directory,
    Projects,
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


@bp.route('/collaborators', methods=['GET'])
@auth.login_required
def get_project_collaborators():
    pass


@bp.route('/collaborators/add', methods=['POST'])
@auth.login_required
@requires_project_role('project-admin')
def add_collaborator():

    proj_service = get_projects_service()

    data = request.get_json()

    project_name = data['projectName']
    project_role = data['role']
    collab_email = data['email']

    projects = Projects.query.filter(
        Projects.project_name == project_name
    ).one_or_none()

    if projects is None:
        raise RecordNotFoundException(f'No such projects: {project_name}')

    new_collaborator = AppUser.query.filter(
        AppUser.email == collab_email
    ).one_or_none()

    if new_collaborator is None:
        raise RecordNotFoundException(f'No such user email: {collab_email}')

    user = g.current_user

    yield user, projects

    new_role = AppRole.query.filter(AppRole.name == project_role).one()
    proj_service.add_role(new_collaborator, new_role, projects)

    yield jsonify(dict(result='success')), 200


@bp.route('/collaborators/remove', methods=['POST'])
@auth.login_required
@requires_project_role('project-admin')
def remove_collaborator():

    proj_service = get_projects_service()

    data = request.get_json()
    user = g.current_user

    project_name = data['projectName']
    project_role = data['role']
    collab_email = data['email']

    projects = Projects.query.filter(
        Projects.project_name == project_name
    ).one_or_none()

    if projects is None:
        raise RecordNotFoundException(f'No such projects: {project_name}')

    new_collaborator = AppUser.query.filter(
        AppUser.email == collab_email
    ).one_or_none()

    user = g.current_user

    yield user, projects

    new_role = AppRole.query.filter(AppRole.name == project_role).one()
    proj_service.remove_role(new_collaborator, new_role, projects)

    yield jsonify(dict(result='success')), 200
