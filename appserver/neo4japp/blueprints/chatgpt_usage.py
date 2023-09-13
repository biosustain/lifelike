from flask import Blueprint, g
from sqlalchemy import func, Integer
from webargs.flaskparser import use_args

from neo4japp.database import db
from neo4japp.exceptions.exceptions import (
    NotAuthorized,
    ServerException,
)
from neo4japp.exceptions.wrap_exceptions import wrap_exceptions
from neo4japp.models.chatgpt_usage import ChatGPTUsage
from neo4japp.schemas.chatgpt_usage import ChatGPTUsageQuery, ChatGPTUsageResponse

bp = Blueprint('chatgpt usage', __name__, url_prefix='/chatgpt-usage')

_interval_mapping = {
    'minute': lambda c: func.date_trunc('minute', c),
    'hour': lambda c: func.date_trunc('hour', c),
    'day': lambda c: func.date_trunc('day', c),
    'week': lambda c: func.date_trunc('week', c),
    'month': lambda c: func.date_trunc('month', c),
    'year': lambda c: func.date_trunc('year', c),
}


def _query_chatgpt_usage(query):
    start = func.to_timestamp(query['start'])
    interval = query.get('interval')
    end = func.to_timestamp(query['end']) if 'end' in query else func.now()
    created_timestamp_s = ChatGPTUsage.usage['created'].cast(Integer)
    created_timestamp = func.to_timestamp(created_timestamp_s)
    filter_clause = created_timestamp.between(start, end)
    user_id = query.get('user_id', None)
    if user_id is not None:
        filter_clause &= ChatGPTUsage.user_id == user_id
    try:
        if interval is not None:
            q = db.session.query(
                func.min(created_timestamp_s).label('start'),
                func.sum(
                    ChatGPTUsage.usage['usage']['total_tokens'].cast(Integer)
                ).label('value'),
                func.max(created_timestamp_s).label('end'),
            ).group_by(_interval_mapping[interval](created_timestamp))
        else:
            q = db.session.query(
                created_timestamp_s.label('start'),
                ChatGPTUsage.usage['usage']['total_tokens']
                .cast(Integer)
                .label('value'),
                created_timestamp_s.label('end'),
            )
        results = q.filter(filter_clause).all()
    except Exception:
        db.session.rollback()
        raise
    else:
        return ChatGPTUsageResponse().dump(dict(results=results, query=query))


@bp.route('', methods=['GET'])
@use_args(ChatGPTUsageQuery)
@wrap_exceptions(ServerException, title='Failed to retrieve ChatGPT usage')
def _get_usage(query_params):
    if g.current_user.has_role('admin') is False:
        raise NotAuthorized()
    else:
        return _query_chatgpt_usage(query_params)


@bp.route('/<int:user_id>', methods=['GET'])
@use_args(ChatGPTUsageQuery)
@wrap_exceptions(ServerException, title='Failed to retrieve user ChatGPT usage')
def _get_user_usage(query_params, user_id):
    if g.current_user.has_role('admin') is False:
        raise NotAuthorized()
    else:
        return _query_chatgpt_usage(dict(user_id=user_id, **query_params))
