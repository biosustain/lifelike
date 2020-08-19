from neo4japp.services.common import RDBMSBaseDao
from neo4japp.models import AppRole, AppUser
from sqlalchemy.orm.exc import NoResultFound
from neo4japp.exceptions import DuplicateRecord, NotAuthorizedException
from neo4japp.data_transfer_objects import UserUpdateRequest

from typing import Sequence


class AccountService(RDBMSBaseDao):
    def __init__(self, session):
        super().__init__(session)

    def create_user(
        self,
        username: str,
        email: str,
        password: str,
        roles: Sequence[str] = [],
        first_name: str = '',
        last_name: str = '',
        commit_now=True
    ) -> AppUser:
        if self.exists(AppUser.query_by_email(email)):
            raise DuplicateRecord(f'E-mail {email} already taken')
        elif self.exists(AppUser.query_by_username(username)):
            raise DuplicateRecord(f'Username {username} already taken.')

        user = AppUser(
            username=username,
            email=email,
            first_name=first_name,
            last_name=last_name
        )
        user.set_password(password)

        for r in roles:
            user.roles.append(self.get_or_create_role(r))

        self.session.add(user)
        self.commit_or_flush(commit_now)
        return user

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
                    'You do not have enough priviledges to delete a user')
            elif user.id == admin.id:
                raise NotAuthorizedException(
                    'You cannot delete your own account')
        self.session.delete(user)
        self.commit_or_flush(commit_now)

    def get_user_list(self, query_dict={}) -> Sequence[AppUser]:
        username = query_dict.get("username", "")

        if len(username) > 0:
            return AppUser.query.filter(
                AppUser.username.contains(username)
            ).order_by(AppUser.username).limit(10).all()
        else:
            return AppUser.query.order_by(AppUser.username).all()

    def update_user(self, user: AppUser, changes: UserUpdateRequest, commit_now=True) -> AppUser:
        # TODO: 'user roll' updates will have to be handled separately

        user.username = changes.username
        user.first_name = changes.first_name
        user.last_name = changes.last_name
        user.email = changes.email

        if changes.new_password:
            if user.check_password(changes.password):
                user.set_password(changes.new_password)
            else:
                raise NotAuthorizedException('Old password is invalid')
        self.commit_or_flush(commit_now)
        return user
