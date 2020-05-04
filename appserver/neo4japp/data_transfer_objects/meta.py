import attr
from neo4japp.util import CamelDictMixin


@attr.s(frozen=True)
class BuildInformation(CamelDictMixin):
    """ Contains the timestamp and build information """
    timestamp: str = attr.ib()
    git_hash: str = attr.ib()
