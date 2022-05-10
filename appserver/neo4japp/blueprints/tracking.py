from http import HTTPStatus

from flask import Blueprint, current_app, g
from neo4japp.constants import LogEventType
from neo4japp.schemas.tracking import ClientEventSchema
from webargs.flaskparser import use_args

bp = Blueprint('tracking', __name__, url_prefix='/tracking')


@bp.route('/', methods=['POST'])
@use_args(ClientEventSchema())
def client_event(args):
    current_app.logger.info(
        args.get('action'),
        extra={
            'username': g.current_user.username,
            'event_type': LogEventType.CLIENT_EVENT.value,
            **args,
        },
    )
    return '', HTTPStatus.NO_CONTENT
