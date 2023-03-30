from dataclasses import dataclass, asdict, field, MISSING
from http import HTTPStatus
from typing import Union, Tuple, Optional, Generic, TypeVar, List, Any, cast

from neo4japp.utils.globals import transaction_id


VT = TypeVar("VT")


class DefaultValueFromCause(Generic[VT]):
    def __init__(self, default: VT):
        self.default = default

    def __set_name__(self, owner, name: str):
        self.name = name

    def __get__(self, obj: Warning, obj_type=None) -> Union[VT, Any]:
        if obj:
            value = vars(obj)[self.name]
            if value is not MISSING:
                return value
            value = self.cause_value(obj)
            if value is not MISSING:
                return value
        return self.default

    def cause_value(self, obj: Warning) -> Union[VT, Any]:
        if obj.__cause__ and hasattr(obj.__cause__, self.name):
            return getattr(obj.__cause__, self.name)
        return MISSING

    def __set__(self, obj: Warning, value: VT):
        # Set to missing if not set
        vars(obj)[self.name] = MISSING if value is self else value


DefaultValueFromCauseType = Union[VT, DefaultValueFromCause[VT]]


@dataclass(repr=False, frozen=True)
class ServerWarning(Warning):
    """
    Create a new warning.
    :param title: the title of the warning, which sometimes used on the client
    :param message: a message that can be displayed to the user
    :param additional_msgs: a list of messages that contain more details for the user
    :param code: the warning code
    :param fields:
    """
    title: DefaultValueFromCauseType[str] = \
        DefaultValueFromCause("Server returned warning")
    message: DefaultValueFromCauseType[Optional[str]] = \
        DefaultValueFromCause[Optional[str]]("Code executed with following warnings")
    additional_msgs: DefaultValueFromCauseType[Tuple[str, ...]] = \
        DefaultValueFromCause[Tuple[str, ...]](tuple())
    fields: DefaultValueFromCauseType[Optional[dict]] = \
        DefaultValueFromCause[Optional[dict]](None)
    code: DefaultValueFromCauseType[HTTPStatus] = \
        DefaultValueFromCause[HTTPStatus](cast(HTTPStatus, 199))
    stacktrace: Optional[str] = None
    version: Optional[str] = None

    @property
    def type(self):
        return type(self).__name__

    @property
    def transaction_id(self):
        return transaction_id

    def __str__(self):
        return f'<Warning {self.transaction_id}>\t{self.title}:\t{self.message}'

    def to_dict(self):
        return asdict(self)


@dataclass(repr=False, frozen=True)
class ContentValidationWarning(ServerWarning):
    pass


__all__ = [
    "ServerWarning",
    "ContentValidationWarning"
]
