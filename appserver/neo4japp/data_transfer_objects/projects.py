import attr
from typing import Dict, Sequence, Union
from neo4japp.util import CamelDictMixin


@attr.s(frozen=True)
class DirectoryUpdateRequest(CamelDictMixin):
    """ Directory update request """
    attribute: str = attr.ib()
    value: Union[str, int] = attr.ib()


@attr.s(frozen=True)
class DirectoryContent(CamelDictMixin):
    """ Contains contents of a directory """
    child_directories: Sequence[Dict] = attr.ib()
    files: Sequence[Dict] = attr.ib()
    maps: Sequence[Dict] = attr.ib()
