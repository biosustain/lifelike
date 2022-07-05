import attr
from flask import current_app, g


@attr.s(frozen=True)
class EventLog():
    """ Used to describe a specific event """
    event_type: str = attr.ib()

    def to_dict(self):
        return attr.asdict(self)


@attr.s(frozen=True)
class UserEventLog(EventLog):
    """ Used to describe an event triggered by a user """
    username: str = attr.ib()


@attr.s(frozen=True)
class ErrorLog(UserEventLog, EventLog):
    """ Used to describe errors """
    error_name: str = attr.ib()
    expected: bool = attr.ib()


@attr.s(frozen=True)
class ClientErrorLog(ErrorLog):
    """ Used to describe client side errors """
    url: str = attr.ib()


def log_user_action(message, **kwargs):
    """
    Sends user action to the logging system.
    """
    current_user = g.get('current_user')
    current_app.logger.info(
        message,
        extra={
            'event_type': 'server-event',
            'username': current_user.username if current_user else None,
            **kwargs,
        },
    )
