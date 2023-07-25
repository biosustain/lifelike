import functools
from http import HTTPStatus

from flask import current_app

from neo4japp.database import (
    get_authorization_service,
)
from neo4japp.exceptions import NotAuthorized


def only_in_dev():
    """Returns a decorator which checks if the app is running in dev mode"""

    def in_dev(f):
        @functools.wraps(f)
        def decorator(*args, **kwargs):
            gen = f(*args, **kwargs)
            try:
                principal = next(gen)
                auth = get_authorization_service()
                if not current_app.config.get('DEBUG'):
                    raise NotAuthorized(
                        title='Unable to Process Request',
                        message=f'{principal} does not have the required role: {role}',
                        code=HTTPStatus.BAD_REQUEST,
                    )
                retval = next(gen)
            finally:
                gen.close()
            return retval

        return decorator

    return in_dev
