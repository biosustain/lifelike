from http import HTTPStatus

from flask import Blueprint, current_app

from neo4japp.blueprints.auth import login_optional
from neo4japp.constants import LogEventType
from neo4japp.schemas.tracking import ClientEventSchema
from webargs.flaskparser import use_args

from neo4japp.utils.globals import get_current_username

bp = Blueprint('tracking', __name__, url_prefix='/tracking')


@bp.route('/', methods=['POST'])
@login_optional
@use_args(ClientEventSchema())
def client_event(args):
    current_app.logger.info(
        args.get('action'),
        extra={
            'username': get_current_username(),
            'event_type': LogEventType.CLIENT_EVENT.value,
            **args,
        },
    )
    return '', HTTPStatus.NO_CONTENT
