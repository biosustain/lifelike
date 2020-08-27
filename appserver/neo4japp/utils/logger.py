import attr


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
