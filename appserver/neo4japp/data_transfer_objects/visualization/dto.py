import attr

from neo4japp.util import CamelDictMixin

from typing import Dict, List, Optional

@attr.s(frozen=True)
class VisNode(CamelDictMixin):
    id: int = attr.ib()
    label: str = attr.ib()
    data: dict = attr.ib()
    sub_labels: List[str] = attr.ib()
    display_name: str = attr.ib()
    primary_label: str = attr.ib()
    color: dict = attr.ib()
    expanded: bool = attr.ib()

@attr.s(frozen=True)
class DuplicateVisNode(VisNode):
    id: str = attr.ib()
    duplicate_of: int = attr.ib()

@attr.s(frozen=True)
class VisEdge(CamelDictMixin):
    id: int = attr.ib()
    label: str = attr.ib()
    data: dict = attr.ib()
    to: int = attr.ib()
    from_: int = attr.ib()
    arrows: Optional[str] = attr.ib()

    @classmethod
    def build_from_dict(cls, d):
        copy = d.copy()
        copy['from_'] = copy['from']
        del copy['from']
        return super().build_from_dict(copy)

    def to_dict(self):
        copy = self.__dict__.copy()
        copy['from'] = copy['from_']
        del copy['from_']
        return copy

@attr.s(frozen=True)
class DuplicateVisEdge(VisEdge):
    id: str = attr.ib()
    duplicate_of: int = attr.ib()
    original_from: int = attr.ib()
    original_to: int = attr.ib()

@attr.s(frozen=True)
class NodeEdgePair(CamelDictMixin):
    node: VisNode = attr.ib()
    edge: VisEdge = attr.ib()

@attr.s(frozen=True)
class DuplicateNodeEdgePair(CamelDictMixin):
    node: DuplicateVisNode = attr.ib()
    edge: DuplicateVisEdge = attr.ib()

@attr.s(frozen=True)
class ClusteredNode(CamelDictMixin):
    node_id: int = attr.ib()
    edges: List[DuplicateVisEdge] = attr.ib()

@attr.s(frozen=True)
class EdgeSnippetCount(CamelDictMixin):
    edge: VisEdge = attr.ib()
    count: int = attr.ib()

@attr.s(frozen=True)
class ReferenceTableRow(CamelDictMixin):
    node_display_name: str = attr.ib()
    snippet_count: int = attr.ib()
    edge: DuplicateVisEdge = attr.ib()

### Begin Request DTOs ###

@attr.s(frozen=True)
class GetSnippetsFromEdgeRequest(CamelDictMixin):
    edge: VisEdge = attr.ib()

@attr.s(frozen=True)
class GetSnippetsFromDuplicateEdgeRequest(CamelDictMixin):
    edge: DuplicateVisEdge = attr.ib()

@attr.s(frozen=True)
class GetSnippetCountsFromEdgesRequest(CamelDictMixin):
    edges: List[VisEdge] = attr.ib()

@attr.s(frozen=True)
class ReferenceTableDataRequest(CamelDictMixin):
    node_edge_pairs: List[DuplicateNodeEdgePair] = attr.ib()

@attr.s(frozen=True)
class GetGraphDataForClusterRequest(CamelDictMixin):
    clustered_nodes: List[ClusteredNode] = attr.ib()

### End Request DTOs ###

### Begin Respose DTOs

@attr.s(frozen=True)
class GetSnippetsFromEdgeResult(CamelDictMixin):
    from_node_id: int = attr.ib()
    to_node_id: int = attr.ib()
    association: str = attr.ib()
    references: List[str] = attr.ib()


@attr.s(frozen=True)
class GetSnippetCountsFromEdgesResult(CamelDictMixin):
    edge_snippet_counts: List[EdgeSnippetCount] = attr.ib()


@attr.s(frozen=True)
class GetClusterGraphDataResult(CamelDictMixin):
    results: Dict[int, Dict[str, int]] = attr.ib()


@attr.s(frozen=True)
class GetReferenceTableDataResult(CamelDictMixin):
    reference_table_rows: List[ReferenceTableRow] = attr.ib()

    # Override the default formatter to convert 'from_' attribute of edges
    def formatter(self, get_reference_table_data_result_dict: dict):
        for row in get_reference_table_data_result_dict['reference_table_rows']:
            edge = row['edge']
            edge['from'] = edge['from_']
            del edge['from_']
        return get_reference_table_data_result_dict

### End Response DTOs ###