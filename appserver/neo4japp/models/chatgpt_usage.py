import functools

from flask import g, current_app
from sqlalchemy.dialects import postgresql

from neo4japp.database import db
from .common import RDBMSBase
from ..constants import LogEventType
from ..exceptions import wrap_exceptions, ServerException
from ..utils import EventLog


class ChatGPTUsage(RDBMSBase):
    """
    Table to track usage of ChatGPT
    """

    __tablename__ = 'chatgpt_usage'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey('appuser.id', ondelete='CASCADE'),
        index=True,
        nullable=False,
    )
    user = db.relationship('AppUser', foreign_keys=user_id)
    usage = db.Column(postgresql.JSONB, nullable=False)


@wrap_exceptions(ServerException, title='Failed to save ChatGPT usage')
def _save_response_to_usage_tracking_table(response, user_id):
    # Import what we need, when we need it (Helps to avoid circular dependencies)
    from app import app

    with app.app_context():
        try:
            record = ChatGPTUsage()
            record.user_id = user_id
            record.usage = response
            db.session.add(record)
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(
                'Failed to save ChatGPT usage',
                exc_info=e,
                extra=EventLog(
                    event_type=LogEventType.CHATGPT_USAGE_TRACKING.value
                ).to_dict(),
            )
            raise e


def save_response_to_usage_tracking_table(func):
    """Decorator that saves ChatGPT usage to database"""

    @functools.wraps(func)
    @wrap_exceptions(
        ServerException, Exception, title='Failed to enquue saving of ChatGPT usage'
    )
    def wrapper(*args, **kwargs):
        from neo4japp.services.redis.redis_queue_service import RedisQueueService

        response = func(*args, **kwargs)
        rq_service = RedisQueueService()
        rq_service.enqueue(
            _save_response_to_usage_tracking_table, response, g.current_user.id
        )
        return response

    return functools.update_wrapper(wrapper, func)


def save_stream_response_to_usage_tracking_table(func):
    """Decorator that saves ChatGPT usage to database"""

    @functools.wraps(func)
    @wrap_exceptions(
        ServerException, Exception, title='Failed to enquue saving of ChatGPT usage'
    )
    def wrapper(*args, **kwargs):
        def stream_wrapper(response_stream):
            for response in response_stream:
                yield response
            try:
                from neo4japp.services.redis.redis_queue_service import (
                    RedisQueueService,
                )

                rq_service = RedisQueueService()
                # Ignore inspection cause we catch it in except
                # noinspection PyUnboundLocalVariable
                rq_service.enqueue(_save_response_to_usage_tracking_table, response)
            except NameError:
                pass  # skip of response was never set

        return stream_wrapper(func(*args, **kwargs))

    return functools.update_wrapper(wrapper, func)
