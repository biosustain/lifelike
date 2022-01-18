import functools

from neo4japp.database import (
    get_authorization_service,
)
from neo4japp.exceptions import NotAuthorized


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
                    raise NotAuthorized(
                        title='Unable to Process Request',
                        message=f'{principal} does not have the required role: {role}',
                        code=400
                    )
                retval = next(gen)
            finally:
                gen.close()
            return retval
        return decorator
    return check_role
