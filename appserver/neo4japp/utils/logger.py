import attr

from flask import current_app

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

def log_user_action(message, category, action, label, **kwargs):
    """
    Logs a user action
    """
    username = current_app.g.user and current_app.g.username or None
    current_app.logger.info(
        message,
        extra={
            'category': category,
            'action': action,
            'label': label,
            'username': username,
            **kwargs,
        },
    )
