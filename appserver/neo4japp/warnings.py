from dataclasses import dataclass
from typing import Optional, List

from flask import g, current_app

from neo4japp.base_server_exception import BaseServerException


@dataclass(repr=False)
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

    def __post_init__(self):
        try:
            g.warnings.add(self)
        except AttributeError:  # we are not running in request context
            current_app.logger.warning(self)


@dataclass
class ContentValidationWarning(ServerWarning):
    pass


@dataclass
class ServerWarningGroup(ServerWarning):
    title: str = "Server returned group of warnings"
    warnings: Optional[List[ServerWarning]] = None

    def __post_init__(self, *args, **kwargs):
        if self.warnings:
            self.additional_msgs = tuple((warning.title for warning in self.warnings))
        super().__post_init__()
