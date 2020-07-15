import attr

from werkzeug.datastructures import FileStorage

from neo4japp.util import CamelDictMixin


@attr.s(frozen=True)
class FileUpload(CamelDictMixin):
    annotation_method: str = attr.ib()
    filename: str = attr.ib()
    file_input: FileStorage = attr.ib()
    directory_id: int = attr.ib()
    description: str = attr.ib(default='')
    url: str = attr.ib(default='')
