import functools

from neo4japp.models.auth import AccessActionType
from neo4japp.database import (
    get_authorization_service,
    get_projects_service,
)
from neo4japp.exceptions import NotAuthorizedException


def requires_permission(action: AccessActionType):
    """Returns a check-permission decorator

     For use by flask endpoints to easily add request access control.

     This decorator must be closer than the @bp.route decorator to the
     decorated endpoint function in the decorator stack.

     The decorated endpoint must also be a genearator function, for it
     is used as a co-routine to this decorator.  The first generated
     value must `yield` a tuple of `Principal` and an `Asset`, which
     will then be combined with the `action` parameter for access
     control check.

     Raises NotAuthorizedException if the request does not have the
     correct permission.

     """
    def check_permission(f):
        @functools.wraps(f)
        def decorator(*args, **kwargs):
            gen = f(*args, **kwargs)
            try:
                principal, asset = next(gen)
                auth = get_authorization_service()
                if not auth.is_allowed(principal, action, asset):
                    raise NotAuthorizedException(
                        f'{principal} is not allowed {action} action on {asset}')
                retval = next(gen)
            finally:
                gen.close()
            return retval
        return decorator
    return check_permission


def requires_project_permission(action: AccessActionType):
    """ Returns a check project permission decorator """
    def check_project_permission(f):
        @functools.wraps(f)
        def decorator(*args, **kwargs):
            gen = f(*args, **kwargs)
            try:
                user, projects = next(gen)
                auth = get_authorization_service()

                # SUPER USER ADMIN overrides all permissions
                is_superuser = auth.has_role(user, 'admin')

                if not is_superuser:
                    proj = get_projects_service()
                    role = proj.has_role(user, projects)
                    if role is None or not auth.is_allowed(role, action, projects):
                        raise NotAuthorizedException(
                            f'{user.username} does not have {action.name} privilege'
                        )
                retval = next(gen)
            finally:
                gen.close()
            return retval
        return decorator
    return check_project_permission


def requires_project_role(role: str):
    """ Returns a check project role decorator """
    def check_project_role(f):
        @functools.wraps(f)
        def decorator(*args, **kwargs):
            gen = f(*args, **kwargs)
            try:
                principal, asset = next(gen)
                proj = get_projects_service()
                roles = proj.has_role(principal, asset)
                if roles is None or roles.name != role:
                    raise NotAuthorizedException(
                        f'{principal} does not have required role: {role}'
                    )
                retval = next(gen)
            finally:
                gen.close()
            return retval
        return decorator
    return check_project_role


def requires_role(role: str):
    """ Returns a check-role decorator """
    def check_role(f):
        @functools.wraps(f)
        def decorator(*args, **kwargs):
            gen = f(*args, **kwargs)
            try:
                principal = next(gen)
                auth = get_authorization_service()
                if not auth.has_role(principal, role):
                    raise NotAuthorizedException(
                        f'{principal} does not have the required role: {role}'
                    )
                retval = next(gen)
            finally:
                gen.close()
            return retval
        return decorator
    return check_role
