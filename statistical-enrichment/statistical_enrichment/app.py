from flask import request

from .auth import auth
from .factory import create_app

app = create_app()

# `default_login_required` enforces login on all endpoints by default.
# Credit here: https://stackoverflow.com/a/30761573

# a dummy callable to execute the login_required logic
login_required_dummy_view = auth.login_required(lambda: None)


@app.before_request
def default_login_required():
    # exclude 404 errors and static routes
    # uses split to handle blueprint static routes as well
    if not request.endpoint or request.endpoint.rsplit('.', 1)[-1] == 'static':
        return

    view = app.view_functions[request.endpoint]

    if getattr(view, 'login_exempt', False):
        return

    return login_required_dummy_view()
