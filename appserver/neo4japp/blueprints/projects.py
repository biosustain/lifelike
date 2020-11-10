import re
from typing import List

from flask import (
    current_app,
    request,
    jsonify,
    Blueprint,
    g,
)
from flask.views import MethodView
from sqlalchemy import or_
from sqlalchemy.orm import raiseload, joinedload
from webargs.flaskparser import use_args

from neo4japp.blueprints.auth import auth
from neo4japp.blueprints.permissions import requires_project_role, requires_project_permission
from neo4japp.database import db, get_projects_service
from neo4japp.exceptions import (
    DuplicateRecord,
    RecordNotFoundException,
    NotAuthorizedException,
    NameUnavailableError,
)
from neo4japp.models import (
    AccessActionType,
    AppRole,
    AppUser,
    Projects,
    projects_collaborator_role, Files,
)
from neo4japp.schemas.common import PaginatedRequest
from neo4japp.schemas.filesystem import ProjectListSchema, ProjectListRequestSchema, ProjectSchema
from neo4japp.utils.logger import UserEventLog


class ProjectBaseView(MethodView):
    def get_project(self, identifier: str) -> Projects:
        query = db.session.query(Projects) \
            .options(joinedload(Projects.root),
                     raiseload('*')) \
            .filter(Projects.deletion_date.is_(None),
                    or_(Projects.hash_id == identifier,
                        Projects.name == identifier))

        results: List[Projects] = query.all()

        if not len(results):
            raise RecordNotFoundException("The requested project could not be found.")

        for row in results:
            if row.hash_id == identifier:
                return row

        return results[0]


class ProjectListView(ProjectBaseView):
    decorators = [auth.login_required]

    @use_args(ProjectListRequestSchema)
    @use_args(PaginatedRequest)
    def get(self, params, pagination):
        query = db.session.query(Projects) \
            .options(joinedload(Projects.root),
                     raiseload('*'))

        query = params['sort'](query)
        results = query.paginate(pagination['page'], pagination['limit'], False)

        return jsonify(ProjectListSchema(context={
            'user_privilege_filter': g.current_user.id,
        }).dump({
            'total': results.total,
            'results': results.items,
        }))


class ProjectView(ProjectBaseView):
    decorators = [auth.login_required]

    def get(self, hash_id: str):
        project = self.get_project(hash_id)

        return jsonify({
            'project': ProjectSchema(context={
                'user_privilege_filter': g.current_user.id,
            }).dump(project)
        })


bp = Blueprint('projects', __name__, url_prefix='/projects')
bp.add_url_rule('/', view_func=ProjectListView.as_view('project'))
bp.add_url_rule('/<string:hash_id>', view_func=ProjectView.as_view('project_detail'))


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
    dir = proj_service.get_root_dir(project)

    # Combine both dictionaries
    results = {
        **project.to_dict(),
        "directory": dir.to_dict()
    }
    return jsonify({'results': results}), 200


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
