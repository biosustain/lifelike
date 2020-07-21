import attr
from enum import Enum
from typing import Dict, Sequence, Union
from neo4japp.models import Files, Directory, Project
from neo4japp.util import CamelDictMixin


@attr.s(frozen=True)
class DirectoryRenameRequest(CamelDictMixin):
    """ Directory update request """
    name: str = attr.ib()


@attr.s(frozen=True)
class DirectoryDeleteRequest(CamelDictMixin):
    """ Direcotry delete request """
    dir_id: int = attr.ib()


@attr.s(frozen=True)
class DirectoryContent(CamelDictMixin):
    """ Contains contents of a directory """
    child_directories: Sequence[Dict] = attr.ib()
    files: Sequence[Dict] = attr.ib()
    maps: Sequence[Dict] = attr.ib()
    dir: Dict = attr.ib()
    path: Sequence[Dict] = attr.ib()
    objects: Sequence[Dict] = attr.ib()


class FileType(Enum):
    PDF = 'pdf'
    MAP = 'map'
    DIR = 'dir'


@attr.s(frozen=True)
class MoveFileRequest(CamelDictMixin):
    """ File move request Directory, PDF, and
    maps are considered 'Files'
    """
    asset_id: int = attr.ib()
    dest_dir_id: int = attr.ib()
    asset_type: FileType = attr.ib()


@attr.s(frozen=True)
class MoveFileResponse(CamelDictMixin):
    dest: Directory = attr.ib()
    asset: Union[Files, Project, Directory] = attr.ib()
