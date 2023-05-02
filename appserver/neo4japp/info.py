from dataclasses import dataclass
from http import HTTPStatus
from typing import Union, Optional

from neo4japp.message import ServerMessage
from neo4japp.utils.transaction import get_transaction_id


@dataclass(repr=False)
class ServerInfo(ServerMessage):
    """
    Create a new Info.
    :param title: the title of the Info, which sometimes used on the client
    :param message: a message that can be displayed to the user
    :param additional_msgs: a list of messages that contain more details for the user
    :param code: the Info code
    :param fields:
    """
    title: str = "Server returned information message"
    message: Optional[str] = "Code executed with following informations"
    fields: Optional[dict] = None
    code: Union[HTTPStatus, int] = 104

    @property
    def type(self):
        return type(self).__name__

    @property
    def transaction_id(self):
        return get_transaction_id()

    def __str__(self):
        lines = [f'<{self.type} {self.transaction_id}> {self.title}: {self.message}']
        try:
            lines += [f'\t{key}:\t{value}' for key, value in self.fields.items()]
        except Exception:
            pass
        return '\n'.join(lines)


@dataclass(repr=False)
class ContentValidationInfo(ServerInfo):
    pass
