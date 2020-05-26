import attr
from neo4japp.util import CamelDictMixin
from werkzeug.datastructures import FileStorage


# @attr.s(frozen=True)
# class DrawingUploadMetaData(CamelDictMixin):
#     """ Meta data for drawing map upload """
#     description: str = attr.ib()
#     project_name: str = attr.ib()


@attr.s(frozen=True)
class DrawingUploadRequest(CamelDictMixin):
    """ Request for uploading a drawing (map) """
    description: str = attr.ib()
    project_name: str = attr.ib()
    file_input: FileStorage = attr.ib()
