from dataclasses import dataclass, asdict
from http import HTTPStatus
from typing import Union, Optional

from neo4japp.base_server_exception import BaseServerException


@dataclass(repr=False, frozen=True)
class ServerWarning(Warning, BaseServerException):
    """
    Create a new warning.
    :param title: the title of the warning, which sometimes used on the client
    :param message: a message that can be displayed to the user
    :param additional_msgs: a list of messages that contain more details for the user
    :param code: the warning code
    :param fields:
    """
    title: str = "Server returned warning"
    message: Optional[str] = "Code executed with following warnings"
    code: Union[HTTPStatus, int] = 199


    def to_dict(self):
        return asdict(self)


@dataclass(repr=False, frozen=True)
class ContentValidationWarning(ServerWarning):
    pass
