import attr
from werkzeug.datastructures import FileStorage

from neo4japp.models import Projects, AppUser
from neo4japp.util import CamelDictMixin, CasePreservedDict


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


@attr.s(frozen=True)
class PublicMap(CamelDictMixin):
    map: CasePreservedDict = attr.ib()
    user: AppUser = attr.ib()
    project: Projects = attr.ib()
