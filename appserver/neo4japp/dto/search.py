import attr
from typing import List

from neo4japp.models import GraphNode
from neo4japp.util import CamelDictMixin


@attr.s(frozen=True)
class FTSQueryRecord(CamelDictMixin):
    """ Single record from a full text query in Neo4j """
    id: int = attr.ib()
    node: GraphNode = attr.ib()
    score: int = attr.ib()


@attr.s(frozen=True)
class FTSResult(CamelDictMixin):
    """ Paginated results for a full text search query in Neo4j """
    query: str = attr.ib()
    nodes: List[FTSQueryRecord] = attr.ib()
    total: int = attr.ib()
    page: int = attr.ib()
    limit: int = attr.ib()
