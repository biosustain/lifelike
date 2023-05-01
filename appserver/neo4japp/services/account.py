from sqlalchemy.exc import SQLAlchemyError

from neo4japp.database import get_projects_service, db
from neo4japp.exceptions import ServerException, NotAuthorized, wrap_exceptions
from neo4japp.models import AppRole, AppUser
from neo4japp.services.common import RDBMSBaseDao


class AccountService(RDBMSBaseDao):
    def __init__(self, session):
        super().__init__(session)

    def get_or_create_role(self, rolename: str) -> AppRole:
        retval = AppRole.query.filter_by(name=rolename).first()
        if retval is None:
            retval = AppRole(name=rolename)
            self.session.add(retval)
        return retval

    @staticmethod
    def create_user(user: AppUser):
        projects_service = get_projects_service()

        # Finally, add the new user to the DB
        try:
            with db.session.begin_nested():
                projects_service.create_initial_project(user)
                db.session.add(user)
        except SQLAlchemyError as e:
            raise ServerException(
                title='Unexpected Database Transaction Error',
                message='Something unexpected occurred while adding the user to the database.',
                fields={
                    'user_id': user.id if user.id is not None else 'N/A',
                    'username': user.username,
                    'user_email': user.email,
                },
            ) from e

    @wrap_exceptions(ServerException, title='Failed to Delete User')
    def delete_user(self, admin_username: str, username: str):
        admin = AppUser.query.filter_by(username=admin_username)
        user = AppUser.query.filter_by(username=username)
        if user and admin:
            if 'admin' not in [r.name for r in admin.roles]:
                raise NotAuthorized(
                    message='You do not have enough privileges to delete a user.'
                )
            elif user.id == admin.id:
                raise ServerException(message='You cannot delete your own account.')

        self.session.delete(user)
