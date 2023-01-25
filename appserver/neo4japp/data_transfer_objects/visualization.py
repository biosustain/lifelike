import attr
from enum import Enum

from neo4japp.exceptions import FormatterException
from neo4japp.models import GraphNode
from neo4japp.util import CamelDictMixin

from typing import Dict, List, Optional


# Start Enums #

class Direction(Enum):
    TO = 'Incoming'
    FROM = 'Outgoing'

# End Enums


@attr.s(frozen=True)
class VisNode(CamelDictMixin):
    id: str = attr.ib()
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
    duplicate_of: str = attr.ib()


@attr.s(frozen=True)
class VisEdge(CamelDictMixin):
    id: str = attr.ib()
    label: str = attr.ib()
    data: dict = attr.ib()
    to: str = attr.ib()
    from_: str = attr.ib()
    to_label: str = attr.ib()
    from_label: str = attr.ib()
    arrows: Optional[str] = attr.ib()

    def build_from_dict_formatter(self, vis_edge_input_dict: dict):
        vis_edge_input_from_ = vis_edge_input_dict.get('from_', None)
        vis_edge_input_from = vis_edge_input_dict.get('from', None)
        # Error if both 'from' and 'from_' are in the dict, or if neither of them are
        if vis_edge_input_from_ is None and vis_edge_input_from is None:
            raise FormatterException(
                message="Must have either 'from' or 'from_' in a VisEdge dict!"
            )
        elif vis_edge_input_from_ is not None and vis_edge_input_from is not None:
            raise FormatterException(
                message="Cannot have both 'from' and 'from_' in a VisEdge dict!"
            )

        if vis_edge_input_from is not None:
            vis_edge_input_dict['from_'] = vis_edge_input_from
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
    duplicate_of: str = attr.ib()
    original_from: str = attr.ib()
    original_to: str = attr.ib()


@attr.s(frozen=True)
class ReferenceTablePair(CamelDictMixin):
    @attr.s(frozen=True)
    class NodeData(CamelDictMixin):
        id: str = attr.ib()
        display_name: str = attr.ib()
        label: str = attr.ib()

    @attr.s(frozen=True)
    class EdgeData(CamelDictMixin):
        original_from: str = attr.ib()
        original_to: str = attr.ib()
        label: str = attr.ib()

    node: NodeData = attr.ib()
    edge: EdgeData = attr.ib()


@attr.s(frozen=True)
class ReferenceTableRow(CamelDictMixin):
    node_id: str = attr.ib()
    node_display_name: str = attr.ib()
    snippet_count: int = attr.ib()
    node_label: str = attr.ib()


@attr.s(frozen=True)
class Snippet(CamelDictMixin):
    reference: GraphNode = attr.ib()
    publication: GraphNode = attr.ib()


@attr.s(frozen=True)
class EdgeConnectionData(CamelDictMixin):
    from_label: str = attr.ib()
    to_label: str = attr.ib()
    from_: str = attr.ib()
    to: str = attr.ib()
    label: str = attr.ib()

    # 'from_' will be formatted as 'from' because it is coming from the client.
    # Need to re-format it here to the expected value
    def build_from_dict_formatter(self, edge_data_input_dict: dict):
        edge_data_input_dict['from_'] = edge_data_input_dict['from']
        del edge_data_input_dict['from']
        return edge_data_input_dict


@attr.s(frozen=True)
class DuplicateEdgeConnectionData(CamelDictMixin):
    from_label: str = attr.ib()
    to_label: str = attr.ib()
    from_: str = attr.ib()
    to: str = attr.ib()
    original_from: str = attr.ib()
    original_to: str = attr.ib()
    label: str = attr.ib()

    def build_from_dict_formatter(self, edge_data_input_dict: dict):
        edge_data_input_dict['from_'] = edge_data_input_dict['from']
        del edge_data_input_dict['from']
        return edge_data_input_dict

# Begin Request DTOs #


@attr.s(frozen=True)
class ExpandNodeRequest(CamelDictMixin):
    node_id: str = attr.ib()
    filter_labels: List[str] = attr.ib()


@attr.s(frozen=True)
class ReferenceTableDataRequest(CamelDictMixin):
    node_edge_pairs: List[ReferenceTablePair] = attr.ib()
    description: Optional[str] = attr.ib()
    direction: Optional[str] = attr.ib()


@attr.s(frozen=True)
class BulkReferenceTableDataRequest(CamelDictMixin):
    associations: List[ReferenceTableDataRequest] = attr.ib()


@attr.s(frozen=True)
class GetSnippetsForEdgeRequest(CamelDictMixin):
    page: int = attr.ib()
    limit: int = attr.ib()
    edge: EdgeConnectionData = attr.ib()


@attr.s(frozen=True)
class GetSnippetsForClusterRequest(CamelDictMixin):
    page: int = attr.ib()
    limit: int = attr.ib()
    edges: List[DuplicateEdgeConnectionData] = attr.ib()

# End Request DTOs #

# Begin Respose DTOs #


@attr.s(frozen=True)
class GetSnippetsFromEdgeResult(CamelDictMixin):
    from_node_id: str = attr.ib()
    to_node_id: str = attr.ib()
    association: str = attr.ib()
    snippets: List[Snippet] = attr.ib()


@attr.s(frozen=True)
class GetEdgeSnippetsResult(CamelDictMixin):
    snippet_data: GetSnippetsFromEdgeResult = attr.ib()
    total_results: int = attr.ib()
    query_data: EdgeConnectionData = attr.ib()

    def to_dict_formatter(self, edge_data_output_dict: dict):
        edge_data_output_dict['query_data']['from'] = edge_data_output_dict['query_data']['from_']
        del edge_data_output_dict['query_data']['from_']
        return edge_data_output_dict


@attr.s(frozen=True)
class GetClusterSnippetsResult(CamelDictMixin):
    snippet_data: List[GetSnippetsFromEdgeResult] = attr.ib()
    total_results: int = attr.ib()
    query_data: List[DuplicateEdgeConnectionData] = attr.ib()

    def to_dict_formatter(self, edge_data_output_dict: dict):
        for item in edge_data_output_dict['query_data']:
            item['from'] = item['from_']
            del item['from_']
        return edge_data_output_dict


@attr.s(frozen=True)
class GetNodePairSnippetsResult(CamelDictMixin):
    snippet_data: List[GetSnippetsFromEdgeResult] = attr.ib()
    total_results: int = attr.ib()
    query_data: dict = attr.ib()


@attr.s(frozen=True)
class GetReferenceTableDataResult(CamelDictMixin):
    direction: str = attr.ib()
    description: str = attr.ib()
    reference_table_rows: List[ReferenceTableRow] = attr.ib()
    duplicate_node_edge_pairs: List[ReferenceTablePair] = attr.ib()


@attr.s(frozen=True)
class GetBulkReferenceTableDataResult(CamelDictMixin):
    reference_tables: List[GetReferenceTableDataResult] = attr.ib()


@attr.s(frozen=True)
class AssociatedTypesResult(CamelDictMixin):
    name: str = attr.ib()
    node_id: str = attr.ib()
    snippet_count: int = attr.ib()


@attr.s(frozen=True)
class GetAssociatedTypesResult(CamelDictMixin):
    associated_data: List[AssociatedTypesResult] = attr.ib()

# End Response DTOs #
