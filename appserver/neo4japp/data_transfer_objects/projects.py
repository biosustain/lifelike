import attr
from typing import Dict, Sequence
from neo4japp.util import CamelDictMixin


@attr.s(frozen=True)
class DirectoryContent(CamelDictMixin):
    """ Contains contents of a directory """
    child_directories: Sequence[Dict] = attr.ib()
    files: Sequence[Dict] = attr.ib()
    maps: Sequence[Dict] = attr.ib()
