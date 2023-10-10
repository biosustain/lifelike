from http import HTTPStatus

from flask import current_app, g, Blueprint, jsonify
from webargs.flaskparser import use_args

from neo4japp.blueprints.auth import login_optional
from neo4japp.schemas.errors import ClientErrorSchema
from neo4japp.utils import ClientErrorLog
from neo4japp.utils.globals import get_current_username

bp = Blueprint('logging', __name__, url_prefix='/logging')


@bp.route('/', methods=['POST'])
@login_optional
@use_args(ClientErrorSchema())
def client_logging(args):
    """NOTE: This API endpoint is potentially a vulnerable point.
    This has to be paired with an API throttle on the webserver
    and carefully monitored for abuse. We could also reduce the abuse
    through proper CORS settings.
    """
    err = ClientErrorLog(
        error_name=args['title'],
        expected=args.get('expected', False),
        event_type=args.get('label', 'Client Error'),
        transaction_id=args['transaction_id'],
        username=get_current_username(),
        url=args.get('url', 'not specified'),
    )
    current_app.logger.error(
        args.get('detail', 'No further details'), extra=err.to_dict()
    )
    return jsonify(dict(result='success')), HTTPStatus.OK
