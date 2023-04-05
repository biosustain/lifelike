from abc import ABC
from dataclasses import asdict, dataclass
from typing import Optional, Tuple

from pipenv.vendor.ruamel import yaml

from neo4japp.utils.transaction import get_transaction_id
from neo4japp.utils.string import indent_lines, compose_lines


@dataclass(repr=False)
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
        return get_transaction_id()

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
                *(('', *self.additional_msgs, '') if len(self.additional_msgs) else ('',)),
                *yaml.dump(
                    {k: v for k, v in self.to_dict().items() if v and k not in (
                        # Already printed above
                        'type', 'transaction_id', 'title', 'message', 'additional_msgs'
                    )}
                ).splitlines()
            )
        )
