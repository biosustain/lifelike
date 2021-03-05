from neo4japp.services.common import RDBMSBaseDao
from neo4japp.models import AppRole, AppUser
from neo4japp.exceptions import NotAuthorizedException


class AccountService(RDBMSBaseDao):
    def __init__(self, session):
        super().__init__(session)

    def get_or_create_role(self, rolename: str, commit_now=True) -> AppRole:
        retval = AppRole.query.filter_by(name=rolename).first()
        if retval is None:
            retval = AppRole(name=rolename)
            self.session.add(retval)
            self.commit_or_flush(commit_now)
        return retval

    def delete_user(self, admin_username: str, username: str, commit_now=True):
        admin = AppUser.query.filter_by(username=admin_username)
        user = AppUser.query.filter_by(username=username)
        if user and admin:
            if 'admin' not in [r.name for r in admin.roles]:
                raise NotAuthorizedException(
                    'You do not have enough privileges to delete a user')
            elif user.id == admin.id:
                raise NotAuthorizedException(
                    'You cannot delete your own account')
        self.session.delete(user)
        self.commit_or_flush(commit_now)
