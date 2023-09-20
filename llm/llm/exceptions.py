from dataclasses import dataclass


@dataclass(repr=False, eq=False, frozen=True)
class BaseServerException(ABC):
    title: str
    message: Optional[str] = None
    additional_msgs: Tuple[str, ...] = tuple()
    fields: Optional[dict] = None
    stacktrace: Optional[str] = None
    version: Optional[str] = None

    def __new__(cls, *args, **kwargs):
        if cls == BaseServerException or BaseServerException in cls.__bases__:
            raise TypeError("Cannot instantiate abstract class.")
        return super().__new__(cls)

    @property
    def transaction_id(self):
        return transaction_id

    @property
    def type(self):
        return type(self).__name__

    def to_dict(self):
        return asdict(self)

    def __repr__(self):
        return f'<{self.type} {self.transaction_id}> {self.title}:{self.message}'

    def __str__(self):
        return compose_lines(
            self.__repr__(),
            *indent_lines(
                # Additional msgs wrapped with new lines, or just singular newline
                *(
                    ('', *self.additional_msgs, '')
                    if len(self.additional_msgs)
                    else ('',)
                ),
                *yaml.dump(
                    {
                        k: v
                        for k, v in self.to_dict().items()
                        if v
                        and k
                        not in (
                            # Already printed above
                            'type',
                            'transaction_id',
                            'title',
                            'message',
                            'additional_msgs',
                        )
                    }
                ).splitlines(),
            ),
        )


@dataclass(repr=False, eq=False, frozen=True)
class ServerException(Exception, BaseServerException):
    """
    Create a new exception.
    :param title: the title of the error, which sometimes used on the client
    :param message: a message that can be displayed to the user
    :param additional_msgs: a list of messages that contain more details for the user
    :param code: the error code
    :param fields:
    """

    title: str = field(default=CauseDefaultingDescriptor("We're sorry!"))  # type: ignore
    message: Optional[str] = field(  # type: ignore
        default=CauseDefaultingDescriptor("Looks like something went wrong!")
    )
    additional_msgs: Tuple[str, ...] = field(
        default=CauseDefaultingDescriptor(tuple())  # type: ignore
    )
    fields: Optional[dict] = field(default=CauseDefaultingDescriptor(None))  # type: ignore
    code: HTTPStatus = field(  # type: ignore
        default=CauseDefaultingDescriptor(HTTPStatus.INTERNAL_SERVER_ERROR)
    )

    @property
    def type(self):
        return type(self).__name__

    @property
    def transaction_id(self):
        return transaction_id

    def __repr__(self):
        return f'<{self.type} {self.transaction_id}>\t{self.title}:\t{self.message}'

    def __str__(self):
        lines = [self.__repr__()]
        try:
            lines += [f'\t{key}:\t{value}' for key, value in self.fields.items()]
        except Exception:
            pass
        return '\n'.join(lines)

    def to_dict(self):
        return asdict(self)


class JWTTokenException(ServerException):
    """Signals JWT token issue"""

    def __init__(self, title=None, message=None, additional_msgs=[], code=401):
        super().__init__(
            title=title, message=message, additional_msgs=additional_msgs, code=code
        )


class JWTAuthTokenException(JWTTokenException):
    """Signals the JWT auth token has an issue"""

    def __init__(self, title=None, message=None, additional_msgs=[], code=401):
        super().__init__(
            title=title, message=message, additional_msgs=additional_msgs, code=code
        )
