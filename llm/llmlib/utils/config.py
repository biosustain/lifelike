from flask import current_app
from werkzeug.local import LocalProxy

config = LocalProxy(lambda: current_app.config)
