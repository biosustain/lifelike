from flask import g


def get_transaction_id():
    return getattr(g, 'transaction_id', 'call_from_outside_of_request_scope')
