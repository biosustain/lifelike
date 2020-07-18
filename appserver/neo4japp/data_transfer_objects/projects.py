import attr
from typing import Dict, Sequence
from neo4japp.util import CamelDictMixin


@attr.s(frozen=True)
class DirectoryContent(CamelDictMixin):
    """ Contains contents of a directory """
    dir: Dict = attr.ib()
    path: Sequence[Dict] = attr.ib()
    objects: Sequence[Dict] = attr.ib()
