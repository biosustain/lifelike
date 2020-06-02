import attr

from neo4japp.exceptions import FormatterException
from neo4japp.models import GraphNode
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
    id: str = attr.ib()  # type: ignore
    duplicate_of: int = attr.ib()


@attr.s(frozen=True)
class VisEdge(CamelDictMixin):
    id: int = attr.ib()
    label: str = attr.ib()
    data: dict = attr.ib()
    to: int = attr.ib()
    from_: int = attr.ib()
    to_label: str = attr.ib()
    from_label: str = attr.ib()
    arrows: Optional[str] = attr.ib()

    def build_from_dict_formatter(self, vis_edge_input_dict: dict):
        # Error if both 'from' and 'from_' are in the dict, or if neither of them are
        if vis_edge_input_dict.get('from_', None) is None and vis_edge_input_dict.get('from', None) is None:  # noqa
            raise FormatterException("Must have either 'from' or 'from_' in a VisEdge dict!")
        elif vis_edge_input_dict.get('from_', None) is not None and vis_edge_input_dict.get('from', None) is not None:  # noqa
            raise FormatterException("Cannot have both 'from' and 'from_' in a VisEdge dict!")

        if vis_edge_input_dict.get('from', None) is not None:
            vis_edge_input_dict['from_'] = vis_edge_input_dict['from']
            del vis_edge_input_dict['from']
            return vis_edge_input_dict
        else:
            # 'from_' already exists in the dict, so nothing needs to be done
            return vis_edge_input_dict

    def to_dict_formatter(self, vis_edge_output_dict: dict):
        vis_edge_output_dict['from'] = vis_edge_output_dict['from_']
        del vis_edge_output_dict['from_']
        return vis_edge_output_dict


@attr.s(frozen=True)
class DuplicateVisEdge(VisEdge):
    id: str = attr.ib()  # type: ignore
    duplicate_of: int = attr.ib()
    original_from: int = attr.ib()
    original_to: int = attr.ib()


# TODO LL-906: Remove if unused
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
    node_id: str = attr.ib()
    node_display_name: str = attr.ib()
    snippet_count: int = attr.ib()
    edge: DuplicateVisEdge = attr.ib()


@attr.s(frozen=True)
class Snippet(CamelDictMixin):
    reference: GraphNode = attr.ib()
    publication: GraphNode = attr.ib()

# Begin Request DTOs #


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


@attr.s(frozen=True)
class GetSnippetsForEdgeRequest(CamelDictMixin):
    page: int = attr.ib()
    limit: int = attr.ib()
    edge: VisEdge = attr.ib()


@attr.s(frozen=True)
class GetSnippetsForClusterRequest(CamelDictMixin):
    page: int = attr.ib()
    limit: int = attr.ib()
    edges: List[DuplicateVisEdge] = attr.ib()

# End Request DTOs #

# Begin Respose DTOs #


@attr.s(frozen=True)
class GetSnippetsFromEdgeResult(CamelDictMixin):
    from_node_id: int = attr.ib()
    to_node_id: int = attr.ib()
    association: str = attr.ib()
    snippets: List[Snippet] = attr.ib()


@attr.s(frozen=True)
class GetSnippetCountsFromEdgesResult(CamelDictMixin):
    edge_snippet_counts: List[EdgeSnippetCount] = attr.ib()


# TODO LL-906: Remove me
@attr.s(frozen=True)
class GetClusterGraphDataResult(CamelDictMixin):
    results: Dict[int, Dict[str, int]] = attr.ib()


@attr.s(frozen=True)
class GetEdgeSnippetsResult(CamelDictMixin):
    snippet_data: GetSnippetsFromEdgeResult = attr.ib()
    total_results: int = attr.ib()
    query_data: VisEdge = attr.ib()


@attr.s(frozen=True)
class GetClusterSnippetsResult(CamelDictMixin):
    snippet_data: List[GetSnippetsFromEdgeResult] = attr.ib()
    total_results: int = attr.ib()
    query_data: List[DuplicateVisEdge] = attr.ib()


@attr.s(frozen=True)
class GetReferenceTableDataResult(CamelDictMixin):
    reference_table_rows: List[ReferenceTableRow] = attr.ib()

    # Override the default formatter to convert 'from_' attribute of edges
    def to_dict_formatter(self, get_reference_table_data_result_dict: dict):
        for row in get_reference_table_data_result_dict['reference_table_rows']:
            edge = row['edge']
            edge['from'] = edge['from_']
            del edge['from_']
        return get_reference_table_data_result_dict

# End Response DTOs #
