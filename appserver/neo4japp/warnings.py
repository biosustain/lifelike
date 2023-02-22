from dataclasses import dataclass, asdict
from http import HTTPStatus
from typing import Union, Tuple, Optional, List


@dataclass(repr=False)
class ServerWarning(Warning):
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
    additional_msgs: Tuple[str, ...] = tuple()
    fields: Optional[dict] = None
    code: Union[HTTPStatus, int] = 199
    stacktrace: Optional[str] = None
    version: Optional[str] = None

    @property
    def type(self):
        return type(self).__name__

    def __str__(self):
        return f'<Warning> {self.title}:{self.message}'

    def to_dict(self):
        return asdict(self)


@dataclass
class ServerWarningGroup(ServerWarning):
    warnings: Optional[List[ServerWarning]] = None
    title: str = "Server returned group of warnings"

    def __post_init__(self, *args, **kwargs):
        if self.warnings:
            self.additional_msgs = tuple((warning.title for warning in self.warnings))

    def __str__(self):
        compose = f'<WarningGroup> {self.title}:{self.message}'
        for warning in self.warnings:
            compose += f'\n\t{warning}'
        return compose
