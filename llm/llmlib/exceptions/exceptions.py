from abc import ABC
from dataclasses import dataclass, field, asdict
from http import HTTPStatus
from typing import Tuple, Optional, Callable, Any

import yaml
from openai import OpenAIError

from ..utils.transaction_id import transaction_id
from ..utils.dataclass import CauseDefaultingDescriptor, LazyDefaulDescriptor
from ..utils.string import compose_lines, indent_lines


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


@dataclass(repr=False, eq=False, frozen=True)
class JWTTokenException(ServerException):
    """Signals JWT token issue"""
    code: HTTPStatus = HTTPStatus.UNAUTHORIZED


@dataclass(repr=False, eq=False, frozen=True)
class JWTAuthTokenException(JWTTokenException):
    """Signals the JWT auth token has an issue"""
    pass


def openai_cause_accessor(prop: str, default) -> Callable[[Any, str], Any]:
    def _accessor(obj, _):
        if isinstance(obj.__cause__, OpenAIError):
            value = getattr(obj.__cause__, prop)
            if value:
                return value
        return default

    return _accessor


@dataclass(repr=False, eq=False, frozen=True)
class OpenAiServerException(ServerException):
    title: str = 'OpenAI Server Error'
    message: str = field(  # type: ignore
        default=LazyDefaulDescriptor(
            openai_cause_accessor('user_message', "OpenAI Server Error")
        )
    )
    code: HTTPStatus = field(  # type: ignore
        default=LazyDefaulDescriptor(
            openai_cause_accessor('http_status', HTTPStatus.INTERNAL_SERVER_ERROR)
        )
    )
