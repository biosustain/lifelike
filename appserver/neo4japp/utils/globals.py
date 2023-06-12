from flask import current_app, g

from neo4japp.info import ServerInfo
from neo4japp.warnings import ServerWarning


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
