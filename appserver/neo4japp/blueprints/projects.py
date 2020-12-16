from typing import List, Optional, Tuple, Dict, Iterable

from flask import (
    current_app,
    request,
    jsonify,
    Blueprint,
    g,
)
from flask.views import MethodView
from marshmallow import ValidationError
from sqlalchemy import and_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import raiseload, joinedload
from webargs.flaskparser import use_args

from neo4japp.blueprints.auth import auth
from neo4japp.blueprints.permissions import requires_project_role, requires_project_permission
from neo4japp.database import db, get_projects_service
from neo4japp.exceptions import (
    RecordNotFoundException,
    NotAuthorizedException, AccessRequestRequiredError,
)
from neo4japp.models import (
    AccessActionType,
    AppRole,
    AppUser,
    Projects,
    projects_collaborator_role, )
from neo4japp.models.projects_queries import add_project_user_role_columns, ProjectCalculator
from neo4japp.schemas.common import PaginatedRequest
from neo4japp.schemas.filesystem import ProjectListSchema, ProjectListRequestSchema, ProjectSearchRequestSchema, \
    ProjectCreateSchema, ProjectResponseSchema, BulkProjectRequestSchema, \
    BulkProjectUpdateRequestSchema, MultipleProjectResponseSchema, ProjectUpdateRequestSchema
from neo4japp.utils.logger import UserEventLog
from neo4japp.utils.request import Pagination


class ProjectBaseView(MethodView):
    """Base view class for dealing with projects."""

    def get_nondeleted_project_query(self, user: AppUser, accessible_only=False):
        """
        Return a query for fetching non-deleted projects accessible by the passed
        in user. You can add additional filters if needed.

        :param user: the user to check
        :param accessible_only: true to not include non-accessible projects
        :return: the query
        """
        t_role = db.aliased(AppRole)
        t_user = db.aliased(AppUser)

        # The following code gets a collection of projects, complete with permission
        # information for the current user, all in one go. Unfortunately, it's complex, but
        # it should be manageable if the only instance of this kind of code is in one place
        # (right here). The upside is that all downstream code, including the client, is very
        # simple because all the needed information has already been loaded.

        query = db.session.query(Projects) \
            .options(joinedload(Projects.root),
                     raiseload('*')) \
            .filter(Projects.deletion_date.is_(None)) \
            .distinct()

        if accessible_only:
            expected_roles = ['project-read', 'project-admin']

            project_role_sq = db.session.query(projects_collaborator_role, t_role.name) \
                .join(t_role, t_role.id == projects_collaborator_role.c.app_role_id) \
                .join(t_user, t_user.id == projects_collaborator_role.c.appuser_id) \
                .subquery()

            # This code does an inner join of the necessary role columns, so if the user
            # doesn't have the roles, they don't have permission
            query = query.join(project_role_sq, and_(project_role_sq.c.projects_id == Projects.id,
                                                     project_role_sq.c.appuser_id == user.id,
                                                     project_role_sq.c.name.in_(expected_roles)))

        # Add extra boolean columns to the result indicating various permissions (read, write, etc.)
        # for the current user, which then can be read later by ProjectCalculator or manually
        query = add_project_user_role_columns(query, Projects, user.id)

        return query

    def get_nondeleted_project(self, filter):
        """
        Returns a project that is guaranteed to be non-deleted that
        matches the provided filter.

        :param filter: the SQL Alchemy filter
        :return: a non-null project
        """
        files, *_ = self.get_nondeleted_projects(filter)
        if not len(files):
            raise RecordNotFoundException("The requested project could not be found.")
        return files[0]

    def get_nondeleted_projects(self, filter, accessible_only=False, sort=None,
                                require_hash_ids: List[str] = None,
                                pagination: Optional[Pagination] = None) -> Tuple[List[Projects], int]:
        """
        Returns files that are guaranteed to be non-deleted that match the
        provided filter.

        :param filter: the SQL Alchemy filter
        :param accessible_only: true to only get projects accessible by the current user
        :param sort: optional list of sort columns
        :param pagination: optional pagination
        :return: the result, which may be an empty list
        """
        current_user = g.current_user

        query = self.get_nondeleted_project_query(current_user, accessible_only=accessible_only) \
            .order_by(*sort or [])

        if filter is not None:
            query = query.filter(filter)

        if pagination:
            paginated_results = query.paginate(pagination.page, pagination.limit)
            results = paginated_results.items
            total = paginated_results.total
        else:
            results = query.all()
            total = len(results)

        projects = []

        # We added permission columns to the result of the query, but we need to put them
        # into the instances of Projects (since we only return a list of Projects at the end
        # of this method)
        for row in results:
            calculator = ProjectCalculator(row, Projects)
            calculator.calculate_privileges([current_user.id])
            projects.append(calculator.project)

        # Handle helper require_hash_ids argument that check to see if all projected wanted
        # actually appeared in the results
        if require_hash_ids:
            missing_hash_ids = self.get_missing_hash_ids(require_hash_ids, projects)

            if len(missing_hash_ids):
                raise RecordNotFoundException(f"The request specified one or more projects "
                                              f"({', '.join(missing_hash_ids)}) that could not be found.")

        return projects, total

    def check_project_permissions(self, projects: List[Projects], user: AppUser,
                                  require_permissions: List[str]):
        """
        Helper method to check permissions on the provided projects. On error, an
        exception is thrown.

        :param projects: the projects to check
        :param user: the user to check permissions for
        :param require_permissions: a list of permissions to require (like 'writable')
        """
        # Check each file
        for project in projects:
            for permission in require_permissions:
                if not getattr(project.calculated_privileges[user.id], permission):
                    # Do not reveal the project name with the error!
                    raise AccessRequestRequiredError(
                        f"You do not have '{permission}' access to the specified project "
                        f"(with ID of {project.hash_id}).",
                        project_hash_id=project.hash_id)

    def get_project_response(self, hash_id: str, user: AppUser):
        """
        Fetch a project and return a response that can be sent to the client. Permissions
        are checked and this method will throw a relevant response exception.

        :param hash_id: the hash ID of the project
        :param user: the user to check permissions for
        :return: the response
        """
        return_project = self.get_nondeleted_project(Projects.hash_id == hash_id)
        self.check_project_permissions([return_project], user, ['readable'])

        return jsonify(ProjectResponseSchema(context={
            'user_privilege_filter': g.current_user.id,
        }).dump({
            'project': return_project,
        }))

    def get_bulk_project_response(self, hash_ids: List[str], user: AppUser, *,
                                  missing_hash_ids: Iterable[str] = None):
        projects, total = self.get_nondeleted_projects(Projects.hash_id.in_(hash_ids),
                                                require_hash_ids=hash_ids)
        self.check_project_permissions(projects, user, ['readable'])

        returned_projects = {}

        for project in projects:
            returned_projects[project.hash_id] = project

        return jsonify(MultipleProjectResponseSchema(context={
            'user_privilege_filter': user.id,
        }).dump(dict(
            results=returned_projects,
            missing=list(missing_hash_ids) or [],
        )))

    def update_projects(self, hash_ids: List[str], params: Dict, user: AppUser):
        changed_fields = set()

        projects, total = self.get_nondeleted_projects(Projects.hash_id.in_(hash_ids))
        self.check_project_permissions(projects, user, ['readable'])
        missing_hash_ids = self.get_missing_hash_ids(hash_ids, projects)

        for project in projects:
            for field in ('name', 'description'):
                if field in params:
                    if getattr(project, field) != params[field]:
                        setattr(project, field, params[field])
                        changed_fields.add(field)

        if len(changed_fields):
            try:
                db.session.commit()
            except IntegrityError as e:
                raise ValidationError("The project name is already taken.")

        return missing_hash_ids

    def get_missing_hash_ids(self, expected_hash_ids: Iterable[str], files: Iterable[Projects]):
        found_hash_ids = set(file.hash_id for file in files)
        missing = set()
        for hash_id in expected_hash_ids:
            if hash_id not in found_hash_ids:
                missing.add(hash_id)
        return missing


class ProjectListView(ProjectBaseView):
    decorators = [auth.login_required]

    @use_args(ProjectListRequestSchema)
    @use_args(PaginatedRequest)
    def get(self, params, pagination: Pagination):
        """Endpoint to fetch a list of projects accessible by the user."""
        current_user = g.current_user

        projects, total = self.get_nondeleted_projects(
            None, accessible_only=True,
            sort=params['sort'], pagination=pagination,
        )
        # Not necessary (due to accessible_only=True), but check anyway
        self.check_project_permissions(projects, current_user, ['readable'])

        return jsonify(ProjectListSchema(context={
            'user_privilege_filter': g.current_user.id,
        }).dump({
            'total': total,
            'results': projects,
        }))

    @use_args(ProjectCreateSchema)
    def post(self, params):
        """Endpoint to create a project."""
        current_user = g.current_user

        project_service = get_projects_service()

        project = Projects()
        project.name = params['name']
        project.description = params['description']
        project.creator = current_user

        try:
            db.session.begin_nested()
            project_service.create_project_uncommitted(current_user, project)
            db.session.commit()
            db.session.flush()
        except IntegrityError:
            db.session.rollback()
            raise ValidationError('The project name already is already taken.', 'name')

        db.session.commit()

        return self.get_project_response(project.hash_id, current_user)

    @use_args(lambda request: BulkProjectRequestSchema())
    @use_args(lambda request: BulkProjectUpdateRequestSchema(partial=True))
    def patch(self, targets, params):
        """Project update endpoint."""

        current_user = g.current_user
        missing_hash_ids = self.update_projects(targets['hash_ids'], params, current_user)
        return self.get_bulk_project_response(targets['hash_ids'], current_user,
                                              missing_hash_ids=missing_hash_ids)


class ProjectSearchView(ProjectBaseView):
    decorators = [auth.login_required]

    @use_args(ProjectSearchRequestSchema)
    @use_args(PaginatedRequest)
    def post(self, params: dict, pagination: Pagination):
        """Endpoint to search for projects that match certain criteria."""
        current_user = g.current_user

        projects, total = self.get_nondeleted_projects(
            Projects.name == params['name'],
            accessible_only=True,
            sort=params['sort'],
            pagination=pagination,
        )
        # Not necessary (due to accessible_only=True), but check anyway
        self.check_project_permissions(projects, current_user, ['readable'])

        return jsonify(ProjectListSchema(context={
            'user_privilege_filter': g.current_user.id,
        }).dump({
            'total': total,
            'results': projects,
        }))


class ProjectDetailView(ProjectBaseView):
    decorators = [auth.login_required]

    def get(self, hash_id: str):
        """Endpoint to fetch a project by hash ID."""
        current_user = g.current_user
        return self.get_project_response(hash_id, current_user)

    @use_args(lambda request: ProjectUpdateRequestSchema(partial=True))
    def patch(self, params: dict, hash_id: str):
        """Update a single project."""
        current_user = g.current_user
        self.update_projects([hash_id], params, current_user)
        return self.get(hash_id)


class ProjectCollaboratorsListView(ProjectBaseView):
    decorators = [auth.login_required]

    @use_args(PaginatedRequest)
    def get(self, pagination: Pagination, hash_id):
        """Endpoint to fetch a list of collaborators for a project."""
        current_user = g.current_user
        project = self.get_nondeleted_project(Projects.hash_id == hash_id)
        self.check_project_permissions([project], current_user, ['administrable'])

        query = db.session.query(AppUser, AppRole.name) \
            .join(projects_collaborator_role, AppUser.id == projects_collaborator_role.c.appuser_id) \
            .join(AppRole, AppRole.id == projects_collaborator_role.c.app_role_id)

        paginated_result = query.paginate(pagination.page, pagination.limit, False)



bp = Blueprint('projects', __name__, url_prefix='/projects')
bp.add_url_rule('/search', view_func=ProjectSearchView.as_view('project_search'))
bp.add_url_rule('/projects', view_func=ProjectListView.as_view('project_list'))
bp.add_url_rule('/projects/<string:hash_id>', view_func=ProjectDetailView.as_view('project_detail'))
bp.add_url_rule('/projects/<string:hash_id>/collaborators',
                view_func=ProjectCollaboratorsListView.as_view('project_collaborators_list'))


@bp.route('/projects/<string:project_name>/collaborators', methods=['GET'])
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


@bp.route('/projects/<string:project_name>/collaborators/<string:email>', methods=['POST'])
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


@bp.route('/projects/<string:project_name>/collaborators/<string:username>', methods=['PUT'])
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

    current_app.logger.info(
        f'Modified collaborator {username} for project {project_name}',
        extra=UserEventLog(
            username=g.current_user.username, event_type='edit project collaborator').to_dict()
    )

    yield jsonify({'result': 'success'}), 200


@bp.route('/projects/<string:project_name>/collaborators/<string:username>', methods=['DELETE'])
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
    current_app.logger.info(
        f'Removed collaborator {username} for project {project_name}',
        extra=UserEventLog(
            username=g.current_user.username, event_type='remove project collaborator').to_dict()
    )

    yield jsonify({'result': 'success'}), 200
