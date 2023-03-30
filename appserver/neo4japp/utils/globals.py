from flask import current_app, g

from neo4japp.info import ServerInfo
from neo4japp.warnings import ServerWarning
from flask import g, current_app
from werkzeug.local import LocalProxy
current_user = LocalProxy(lambda: g.current_user.username if g.get('current_user') else 'anonymous')

current_user = LocalProxy(lambda: g.current_user.username if g.get('current_user') else 'anonymous')

warnings = LocalProxy(lambda: tuple(g.warnings) if hasattr(g, 'warnings') else tuple())

info = LocalProxy(lambda: tuple(g.info) if hasattr(g, 'info') else tuple())

transaction_id = LocalProxy(
    lambda: getattr(g, 'transaction_id', 'call_from_outside_of_request_scope')
)

def warn(w: ServerWarning, *, cause: Exception = None):
    if cause:
        try:
            raise w from cause
        except ServerWarning as wwc:
            w = wwc
    if hasattr(g, 'warnings'):
        g.warnings.append(w)
    else:
        current_app.logging.warn(w)


def info(i: ServerInfo):
    if hasattr(g, 'info'):
        g.info.append(i)
    else:
        current_app.logging.info(i)


def get_warnings():
    if hasattr(g, 'warnings'):
        return tuple(g.warnings)
    else:
        return tuple()


def get_info():
    if hasattr(g, 'info'):
        return tuple(g.info)
    else:
        return tuple()
