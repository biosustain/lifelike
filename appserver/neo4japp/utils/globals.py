import logging
from typing import Optional

from flask import g, current_app
from werkzeug.local import LocalProxy

from neo4japp.exceptions import ServerWarning
from neo4japp.info import ServerInfo


def get_current_user(key: Optional[str] = None, default=None):
    """
    Return the current user's attribute with the given key, or None if there is no current user.
    :param key:
    :param default:
    :return:
    """
    current_user = g.get('current_user')
    if current_user:
        if key:
            return getattr(current_user, key, default)
        else:
            return current_user
    else:
        return default


def current_user_get_factory(key: Optional[str], default=None):
    return lambda: get_current_user(key, default)


# Return the current user's username, or 'anonymous' if there is no current user.
get_current_username = current_user_get_factory('username', 'anonymous')

warnings = LocalProxy(lambda: tuple(g.warnings) if hasattr(g, 'warnings') else tuple())

info = LocalProxy(lambda: tuple(g.info) if hasattr(g, 'info') else tuple())

config = LocalProxy(lambda: current_app.config)


def warn(w: ServerWarning, *, cause: Exception = None):
    if cause:
        try:
            raise w from cause
        except ServerWarning as wwc:
            w = wwc
    if hasattr(g, 'warnings'):
        g.warnings.add(w)
    else:
        logging.warn(w)


def inform(i: ServerInfo):
    if hasattr(g, 'info'):
        g.info.add(i)
    else:
        logging.info(i)


__all__ = [
    'warn',
    'inform',
    'warnings',
    'info',
    'config',
    'get_current_user',
    'current_user_get_factory',
    'get_current_username',
]
