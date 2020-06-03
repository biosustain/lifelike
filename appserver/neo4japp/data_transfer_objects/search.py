import attr
from typing import Optional, List

from neo4japp.models import GraphNode
from neo4japp.util import CamelDictMixin


@attr.s(frozen=True)
class FTSQueryRecord(CamelDictMixin):
    """ Single record from a full text query in Neo4j """
    node: GraphNode = attr.ib()
    score: int = attr.ib()


@attr.s(frozen=True)
class FTSTaxonomyRecord(FTSQueryRecord):
    """ Taxonomy data around genes"""
    taxonomy_id: int = attr.ib()
    taxonomy_name: str = attr.ib()


@attr.s(frozen=True)
class FTSReferenceRecord(FTSQueryRecord):
    """ Reference record with metadata """
    publication_title: str = attr.ib()
    publication_year: int = attr.ib()
    publication_id: int = attr.ib()
    relationship: str = attr.ib()
    chemical: Optional[GraphNode] = attr.ib(default=None)
    disease: Optional[GraphNode] = attr.ib(default=None)


@attr.s(frozen=True)
class FTSResult(CamelDictMixin):
    """ Paginated results for a full text search query in Neo4j """
    query: str = attr.ib()
    nodes: List[FTSQueryRecord] = attr.ib()
    total: int = attr.ib()
    page: int = attr.ib()
    limit: int = attr.ib()
