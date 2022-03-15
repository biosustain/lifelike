import json
import logging
import random
import re
import secrets
import string
from pathlib import Path
from uuid import uuid4

from flask import Blueprint, g, jsonify, current_app
from flask.views import MethodView
from sendgrid.helpers.mail import Mail
from sqlalchemy import func, literal_column, or_
from sqlalchemy.dialects.postgresql import aggregate_order_by
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from sqlalchemy.orm.exc import NoResultFound
from sqlalchemy.sql import select
from webargs.flaskparser import use_args

from neo4japp.blueprints.auth import login_exempt
from neo4japp.database import db, get_authorization_service
from neo4japp.exceptions import RecordNotFound, ServerException, NotAuthorized
from neo4japp.models import AppUser, AppRole
from neo4japp.constants import (
    MAX_ALLOWED_LOGIN_FAILURES,
    MESSAGE_SENDER_IDENTITY,
    RESET_PASS_MAIL_CONTENT,
    MIN_TEMP_PASS_LENGTH,
    MAX_TEMP_PASS_LENGTH,
    RESET_PASSWORD_SYMBOLS,
    RESET_PASSWORD_ALPHABET,
    SEND_GRID_API_CLIENT,
    RESET_PASSWORD_EMAIL_TITLE,
    LogEventType
)
from neo4japp.database import db, get_authorization_service, get_projects_service
from neo4japp.exceptions import ServerException, NotAuthorized
from neo4japp.models import AppUser, AppRole, Projects, Files, FileContent
from neo4japp.models.auth import user_role
from neo4japp.schemas.account import (
    UserListSchema,
    UserProfileSchema,
    UserSearchSchema,
    UserProfileListSchema,
    UserCreateSchema,
    UserUpdateSchema,
    UserChangePasswordSchema
)
from neo4japp.schemas.common import PaginatedRequestSchema
from neo4japp.utils.logger import EventLog, UserEventLog
from neo4japp.utils.request import Pagination

bp = Blueprint('accounts', __name__, url_prefix='/accounts')

INITIAL_PROJECT_PATH = Path('fixtures/initial_project')


class AccountView(MethodView):

    def get_or_create_role(self, rolename: str) -> AppRole:
        retval = AppRole.query.filter_by(name=rolename).one_or_none()
        if retval is None:
            retval = AppRole(name=rolename)
            try:
                db.session.add(retval)
                db.session.commit()
            except SQLAlchemyError:
                db.session.rollback()
                raise
        return retval

    def get(self, hash_id):
        t_appuser = AppUser.__table__.alias('t_appuser')
        t_approle = AppRole.__table__.alias('t_approle')

        query = select([
            t_appuser.c.id,
            t_appuser.c.hash_id,
            t_appuser.c.username,
            t_appuser.c.email,
            t_appuser.c.first_name,
            t_appuser.c.last_name,
            t_appuser.c.failed_login_count,
            func.string_agg(
                t_approle.c.name, aggregate_order_by(literal_column("','"), t_approle.c.name)),
        ]).select_from(
            t_appuser.join(user_role, user_role.c.appuser_id == t_appuser.c.id, isouter=True)
                     .join(t_approle, user_role.c.app_role_id == t_approle.c.id, isouter=True)
        ).group_by(
            t_appuser.c.id,
            t_appuser.c.hash_id,
            t_appuser.c.username,
            t_appuser.c.email,
            t_appuser.c.first_name,
            t_appuser.c.last_name,
        )

        if g.current_user.has_role('admin') or g.current_user.has_role('private-data-access'):
            if hash_id:
                query = query.where(t_appuser.c.hash_id == hash_id)
        else:
            # Regular users can only see themselves
            if hash_id and hash_id != g.current_user.hash_id:
                raise NotAuthorized(message='You do not have sufficient privileges.', code=400)
            query = query.where(t_appuser.c.hash_id == g.current_user.hash_id)

        results = [
            {
                'id': id,
                'hash_id': hash_id,
                'username': username,
                'email': email,
                'first_name': first_name,
                'last_name': last_name,
                'locked': failed_login_count >= MAX_ALLOWED_LOGIN_FAILURES,
                'roles': roles.split(',') if roles else ""
            } for id, hash_id, username, email, first_name,
            last_name, failed_login_count, roles in db.session.execute(query).fetchall() if id]

        return jsonify(UserProfileListSchema().dump({
            'total': len(results),
            'results': results,
        }))

    def create_initial_project(self, user: AppUser):
        """
        Create a initial project for the user.
        This method is designed to fail siletly if the project name already exists
        or if initial project template does not exist.
        :param user: user to create initial project for
        """
        project = Projects()
        project.name = f'{user.username}-example'
        project.description = f'Initial project for {user.username}'

        project_service = get_projects_service()

        try:
            db.session.begin_nested()
            project_service.create_project_uncommitted(user, project)
            db.session.commit()
            db.session.flush()
        except IntegrityError:
            db.session.rollback()
            logging.exception('Failed to create initial project with default naming for user %s',
                              user.username)
            project.name += '-' + uuid4().hex[:8]
            try:
                db.session.begin_nested()
                project_service.create_project_uncommitted(user, project)
                db.session.commit()
                db.session.flush()
            except IntegrityError:
                db.session.rollback()
                logging.exception('Failed to create initial project for user %s', user.username)
                return

        with open(INITIAL_PROJECT_PATH / "metadata.json", "r") as metadata_json:
            metadata = json.load(metadata_json)

            for file_metadata in metadata['files']:
                file = Files()
                for key, value in file_metadata.items():
                    if key != 'path':
                        setattr(file, key, value)
                content_path = INITIAL_PROJECT_PATH / file_metadata['path']
                file.filename = file.filename or content_path.stem
                with open(content_path, "rb") as file_content:
                    file.content_id = FileContent().get_or_create(file_content)
                file.user_id = user.id
                file.parent = project.root
                db.session.add(file)

    @use_args(UserCreateSchema)
    def post(self, params: dict):
        admin_or_private_access = g.current_user.has_role('admin') or \
                                  g.current_user.has_role('private-data-access')
        if not admin_or_private_access:
            raise NotAuthorized(
                title='Cannot Create New User',
                message='You do not have sufficient privileges.',
                code=400)
        if db.session.query(AppUser.query_by_email(params['email']).exists()).scalar():
            raise ServerException(
                title='Cannot Create New User',
                message=f'E-mail {params["email"]} already taken.',
                code=400)
        elif db.session.query(AppUser.query_by_username(params["username"]).exists()).scalar():
            raise ServerException(
                title='Cannot Create New User',
                message=f'Username {params["username"]} already taken.',
                code=400)

        app_user = AppUser(
            username=params['username'],
            email=params['email'],
            first_name=params['first_name'],
            last_name=params['last_name'],
            subject=params['email'],
            forced_password_reset=params['created_by_admin']
        )
        app_user.set_password(params['password'])
        if not params.get('roles'):
            # Add default role
            app_user.roles.append(self.get_or_create_role('user'))
        else:
            for role in params['roles']:
                app_user.roles.append(self.get_or_create_role(role))
        try:
            self.create_initial_project(app_user)
            db.session.add(app_user)
            db.session.commit()
        except SQLAlchemyError:
            db.session.rollback()
            raise
        return jsonify(dict(result=app_user.to_dict()))

    @use_args(UserUpdateSchema)
    def put(self, params: dict, hash_id):
        """ Updating password and roles will be delegated to a separate function """
        admin_access = g.current_user.has_role('admin')
        private_access = g.current_user.has_role('private-data-access')
        modifying_own_data = g.current_user.hash_id == hash_id

        if not modifying_own_data and not (admin_access or private_access):
            raise NotAuthorized(
                title='Failed to Update User',
                message='You do not have sufficient privileges.')
        else:
            target = db.session.query(AppUser).filter(AppUser.hash_id == hash_id).one()
            username = params.get('username') or target.username
            if target.username != username:
                if db.session.query(AppUser.query_by_username(username).exists()
                                    ).scalar():
                    raise ServerException(
                        title='Cannot Update The User',
                        message=f'Username {username} already taken.',
                        code=400)
            if params.get('roles'):
                if not admin_access:
                    raise NotAuthorized(
                        title='Failed to Update User',
                        message='You do not have sufficient privileges.')
                if modifying_own_data:
                    raise NotAuthorized(
                        title='Failed to Update User',
                        message='You cannot update your own roles!')
                params['roles'] = [self.get_or_create_role(role) for role in params['roles']]

            for attribute, new_value in params.items():
                setattr(target, attribute, new_value)

            try:
                db.session.add(target)
                db.session.commit()
            except SQLAlchemyError:
                db.session.rollback()
                raise
        return jsonify(dict(result='')), 204

    def delete(self):
        # TODO: Need to implement soft deletes as well as blocking assets from being viewed
        pass


class AccountSubjectView(MethodView):

    def get(self, subject: str):
        """Fetch a single user by their subject. Useful for retrieving users created via a
        3rd-party auth provider, like Keycloak or Google Sign In."""
        user = AppUser.query_by_subject(subject).one_or_none()
        if user is None:
            raise RecordNotFound(
                title='User Not Found',
                message='The requested user could not be found.',
                code=404
            )
        return jsonify(UserProfileSchema().dump({
            'hash_id': user.hash_id,
            'email': user.email,
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'id': user.id,
            'reset_password': user.forced_password_reset,
            'roles': [u.name for u in user.roles],
        }))


account_view = AccountView.as_view('accounts_api')
bp.add_url_rule('/', view_func=account_view, defaults={'hash_id': None}, methods=['GET'])
bp.add_url_rule('/', view_func=account_view, methods=['POST'])
bp.add_url_rule('/<string:hash_id>', view_func=account_view, methods=['GET', 'PUT', 'DELETE'])

account_subject_view = AccountSubjectView.as_view('account_subject_view')
bp.add_url_rule('/subject/<string:subject>', view_func=account_subject_view, methods=['GET'])


@bp.route('/<string:hash_id>/change-password', methods=['POST', 'PUT'])
@use_args(UserChangePasswordSchema)
def update_password(params: dict, hash_id):
    admin_or_private_access = g.current_user.has_role('admin') or \
                              g.current_user.has_role('private-data-access')
    if g.current_user.hash_id != hash_id and admin_or_private_access is False:
        raise NotAuthorized(
            title='Failed to Update User',
            message='You do not have sufficient privileges.')
    else:
        target = db.session.query(AppUser).filter(AppUser.hash_id == hash_id).one()
        if target.check_password(params['password']):
            if target.check_password(params['new_password']):
                raise ServerException(
                    title='Failed to Update User',
                    message='New password cannot be the old one.')
            target.set_password(params['new_password'])
            target.forced_password_reset = False
        else:
            raise ServerException(
                title='Failed to Update User',
                message='Old password is invalid.')
        try:
            db.session.add(target)
            db.session.commit()
        except SQLAlchemyError:
            db.session.rollback()
            raise
    return jsonify(dict(result='')), 204


@bp.route('/<string:email>/reset-password', methods=['GET'])
@login_exempt
def reset_password(email: str):
    try:
        target = AppUser.query.filter_by(email=email).one()
    except NoResultFound:
        current_app.logger.error(
            f'Invalid email: {email} provided in password reset request.',
            extra=EventLog(
                event_type=LogEventType.RESET_PASSWORD.value).to_dict()
        )
        raise ServerException(
            title='Failed to authenticate',
            message=f'A problem occurred validating email {email} for password reset.'
        )

    current_app.logger.info(
        f'User: {target.username} password reset.',
        extra=UserEventLog(
            username=target.username,
            event_type=LogEventType.RESET_PASSWORD.value).to_dict()
    )
    random.seed(secrets.randbits(MAX_TEMP_PASS_LENGTH))

    new_length = secrets.randbits(MAX_TEMP_PASS_LENGTH) % \
        (MAX_TEMP_PASS_LENGTH - MIN_TEMP_PASS_LENGTH) + MIN_TEMP_PASS_LENGTH
    new_password = ''.join(random.sample([secrets.choice(RESET_PASSWORD_SYMBOLS)] +
                                         [secrets.choice(string.ascii_uppercase)] +
                                         [secrets.choice(string.digits)] +
                                         [secrets.choice(RESET_PASSWORD_ALPHABET) for i in range(
                                             new_length - 3)],
                                         new_length))

    message = Mail(
        from_email=MESSAGE_SENDER_IDENTITY,
        to_emails=email,
        subject=RESET_PASSWORD_EMAIL_TITLE,
        html_content=RESET_PASS_MAIL_CONTENT.format(name=target.first_name,
                                                    lastname=target.last_name,
                                                    password=new_password))
    try:
        SEND_GRID_API_CLIENT.send(message)
    except Exception as e:
        raise

    target.set_password(new_password)
    target.forced_password_reset = True
    try:
        db.session.add(target)
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        raise
    return jsonify(dict(result='')), 204


@bp.route('/<string:hash_id>/unlock-user', methods=['GET'])
def unlock_user(hash_id):
    if g.current_user.has_role('admin') is False:
        raise NotAuthorized(
            title='Failed to Unlock User',
            message='You do not have sufficient privileges.')
    else:
        target = db.session.query(AppUser).filter(AppUser.hash_id == hash_id).one()
        target.failed_login_count = 0
        try:
            db.session.add(target)
            db.session.commit()
        except SQLAlchemyError:
            db.session.rollback()
            raise
    return jsonify(dict(result='')), 204


class AccountSearchView(MethodView):

    @use_args(UserSearchSchema)
    @use_args(PaginatedRequestSchema)
    def post(self, params: dict, pagination: Pagination):
        """
        Endpoint to search for users that match certain criteria.

        This endpoint is used to populate user auto-completes, which is used (as of writing)
        on the project collaborators dialog.
        """
        current_user = g.current_user
        query = re.sub("[%_]", "\\\\0", params['query'].strip())
        like_query = f"%{query}%"

        private_data_access = get_authorization_service().has_role(
            current_user, 'private-data-access'
        )

        # This method is inherently dangerous because it allows users to query
        # our entire database of users. For that reason, we only allow exact
        # email address searches at least
        query = db.session.query(AppUser) \
            .filter(or_(AppUser.first_name.ilike(like_query),
                        AppUser.last_name.ilike(like_query),
                        AppUser.username.ilike(like_query),
                        AppUser.email == query,
                        AppUser.hash_id == query))

        # On the project collaborators dialog, we exclude ourselves because you can't
        # (as of writing) change your own permission level, but if you have the private-data-access
        # role, you need to be able to do that
        if not private_data_access and params['exclude_self']:
            query = query.filter(AppUser.id != current_user.id)

        paginated_result = query.paginate(pagination.page, pagination.limit, False)

        return jsonify(UserListSchema().dump({
            'total': paginated_result.total,
            'results': paginated_result.items,
        }))


bp.add_url_rule('/search', view_func=AccountSearchView.as_view('account_search'))
