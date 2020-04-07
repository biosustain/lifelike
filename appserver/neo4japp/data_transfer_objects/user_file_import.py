import attr

from typing import Dict, List, Optional

from werkzeug.datastructures import FileStorage

from neo4japp.util import CamelDictMixin


@attr.s(frozen=True)
class UploadFileRequest(CamelDictMixin):
    file_input: FileStorage = attr.ib()


@attr.s(frozen=True)
class NodePropertiesRequest(CamelDictMixin):
    node_label: str = attr.ib()


@attr.s(frozen=True)
class FileNameAndSheets(CamelDictMixin):
    @attr.s(frozen=True)
    class SheetNameAndColumnNames(CamelDictMixin):
        sheet_name: str = attr.ib()
        # key is column name, value is column index
        sheet_column_names: List[Dict[str, int]] = attr.ib()
        sheet_preview: List[Dict[str, str]] = attr.ib()

    sheets: List[SheetNameAndColumnNames] = attr.ib()
    filename: str = attr.ib()


@attr.s(frozen=True)
class Neo4jNodeMapping(CamelDictMixin):
    """Optional properties are allowed because
    the class is shared between new nodes to create,
    and existing nodes that were previously created.
    """
    @attr.s(frozen=True)
    class MappedToUniversalGraph(CamelDictMixin):
        universal_graph_node_type: str = attr.ib()
        universal_graph_node_property_label: str = attr.ib()
    mapped_node_type: str = attr.ib()
    domain: Optional[str] = attr.ib(default=None)
    mapped_node_property_to: Optional[str] = attr.ib(default=None)
    mapped_node_property_from: Dict[int, str] = attr.ib(default=attr.Factory(dict))
    node_type: Optional[str] = attr.ib(default=None)
    node_properties: Dict[int, str] = attr.ib(default=attr.Factory(dict))
    # this will be used to match a node
    unique_property: Optional[str] = attr.ib(default=None)
    edge: Optional[str] = attr.ib(default=None)
    mapped_to_universal_graph: Optional[MappedToUniversalGraph] = attr.ib(default=None)


@attr.s(frozen=True)
class Neo4jRelationshipMapping(CamelDictMixin):
    edge: Dict[int, str] = attr.ib()
    source_node: Neo4jNodeMapping = attr.ib()
    target_node: Neo4jNodeMapping = attr.ib()
    edge_property: Dict[int, str] = attr.ib(default=attr.Factory(dict))


@attr.s(frozen=True)
class Neo4jColumnMapping(CamelDictMixin):
    """The int values are the column index
    from the excel files."""
    file_name: str = attr.ib()
    sheet_name: str = attr.ib()
    new_nodes: List[Neo4jNodeMapping] = attr.ib(default=attr.Factory(list))
    existing_nodes: List[Neo4jNodeMapping] = attr.ib(default=attr.Factory(list))
    relationships: List[Neo4jRelationshipMapping] = attr.ib(default=attr.Factory(list))
    delimiters: Dict[int, str] = attr.ib(default=attr.Factory(dict))


@attr.s(frozen=True)
class GraphNodeCreationMapping(CamelDictMixin):
    domain: str = attr.ib()
    node_type: str = attr.ib()
    mapped_node_prop_value: str = attr.ib()
    kg_mapped_node_type: str = attr.ib()
    kg_mapped_node_prop: str = attr.ib()
    edge_label: str = attr.ib()
    node_properties: dict = attr.ib(default=attr.Factory(dict))
    mapped_node_prop: dict = attr.ib(default=attr.Factory(dict))


@attr.s(frozen=True)
class GraphRelationshipCreationMapping(CamelDictMixin):
    source_node_label: str = attr.ib()
    source_node_prop_label: str = attr.ib()
    source_node_prop_value: str = attr.ib()
    target_node_label: str = attr.ib()
    target_node_prop_label: str = attr.ib()
    target_node_prop_value: str = attr.ib()
    edge_label: str = attr.ib()
    source_node_properties: dict = attr.ib(default=attr.Factory(dict))


@attr.s(frozen=True)
class GraphCreationMapping(CamelDictMixin):
    new_nodes: List[GraphNodeCreationMapping] = attr.ib(default=attr.Factory(list))
    new_relationships: List[GraphRelationshipCreationMapping] = attr.ib(default=attr.Factory(list))
