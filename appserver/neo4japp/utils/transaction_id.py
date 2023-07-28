from flask import g
from werkzeug.local import LocalProxy

transaction_id = LocalProxy(
    lambda: getattr(g, 'transaction_id', 'call_from_outside_of_request_scope')
)