from flask import g, current_app

from neo4japp.warnings import ServerWarning


def warn(w: ServerWarning):
    if hasattr(g, 'warnings'):
        g.warnings.append(w)
    else:
        current_app.logging.warn(w)


def get_warnings():
    if hasattr(g, 'warnings'):
        return tuple(g.warnings)
    else:
        return tuple()
