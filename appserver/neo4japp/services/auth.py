from sqlalchemy import and_
from sqlalchemy.orm.session import Session

from neo4japp.services.common import RDBMSBaseDao
from neo4japp.models import (
    RDBMSBase,
    AccessActionType,
    AccessControlPolicy,
    AccessRuleType,
    AppUser,
    Project,
)

from typing import Iterable, Sequence, Union


class AuthService(RDBMSBaseDao):
    def __init__(self, session: Session):
        super().__init__(session)

    def grant(
        self,
        permission: str,
        asset: RDBMSBase,
        user: AppUser,
        commit_now: bool = True,
    ) -> Sequence[AccessControlPolicy]:
        """ Grant a permission, or priviledge on an asset to a user

        Returns the number of access control policies created
        from granting that priviledge. Multiple policies
        may be created from a single permission or priviledge.

        """
        retval = []
        policy = AccessControlPolicy(
            action=permission,
            asset_type=asset.__tablename__,
            asset_id=asset.id,
            principal_type=user.__tablename__,
            principal_id=user.id,
            rule_type=AccessRuleType.ALLOW,
        )

        existing_permissions_query = self.session.query(
            AccessControlPolicy.action,
        ).filter(
            and_(
                AccessControlPolicy.asset_id == asset.id,
                AccessControlPolicy.principal_id == user.id,
                AccessControlPolicy.rule_type == AccessRuleType.ALLOW,
            )
        )

        existing_permissions = [p[0] for p in existing_permissions_query.all()]

        if permission not in existing_permissions:
            self.session.add(policy)

            # 'write' permission implies 'read' permission
            if permission == 'write' and 'read' not in existing_permissions:
                p2 = AccessControlPolicy(
                    action='read',
                    asset_type=asset.__tablename__,
                    asset_id=asset.id,
                    principal_type=user.__tablename__,
                    principal_id=user.id,
                    rule_type=AccessRuleType.ALLOW,
                )
                self.session.add(p2)
                self.commit_or_flush(commit_now)
                retval.append(p2)
        return retval

    def revoke(
        self,
        permission: str,
        asset: RDBMSBase,
        user: AppUser,
        commit_now: bool = True,
    ) -> None:
        """ Revokes a permission, or priviledge on an asset to a user """
        # only removes the write permission on the specific asset
        if permission == 'write':
            AccessControlPolicy.query.filter(
                and_(
                    AccessControlPolicy.action == 'write',
                    AccessControlPolicy.asset_id == asset.id,
                    AccessControlPolicy.principal_id == user.id,
                    AccessControlPolicy.rule_type == AccessRuleType.ALLOW,
                )
            ).delete()
        elif permission == 'read':
            AccessControlPolicy.query.filter(
                and_(
                    AccessControlPolicy.action == 'read',
                    AccessControlPolicy.asset_id == asset.id,
                    AccessControlPolicy.rule_type == AccessRuleType.ALLOW,
                )
            ).delete()
        self.commit_or_flush(commit_now)

    def has_role(
        self,
        principal: RDBMSBase,
        role: str,
    ) -> bool:
        # TODO: Add other principal types
        if isinstance(principal, AppUser):
            return role in [r.name for r in principal.roles]
        raise NotImplementedError

    def is_allowed(
        self,
        principal: RDBMSBase,
        action: str,
        asset: RDBMSBase,
    ) -> bool:
        # TODO: Add other principal types
        if isinstance(principal, AppUser):
            if (type(asset) is Project):
                return self.user_is_allowed_project_action(
                    principal, action, asset)
        raise NotImplementedError

    def user_is_allowed_project_action(
        self,
        user: AppUser,
        action: str,
        project: Project,
    ) -> bool:
        """ Return whether user has given access to a project. """
        # anyone can read the public project
        if not project.is_private and action == 'read':
            return True
        # only is always allowed
        elif user.id == project.user_id:
            return True
        return self.has_allow_and_no_deny(
            AccessControlPolicy.query_by_user_and_project_id(
                user.id, project.id, action
            )
        )

    def has_allow_and_no_deny(
        self,
        acp: Iterable[AccessControlPolicy],
    ) -> bool:
        """ Return True if there is AT LEAST one 'ALLOW'
        rule and no 'DENY' rule in the list.

        Any 'DENY' rule overrides an 'ALLOW' rule
        for the same specificity
        """
        retval = False
        for access in acp:
            if access.rule_type == AccessRuleType.DENY:
                return False
            if access.rule_type == AccessRuleType.ALLOW:
                retval = True
        return retval
