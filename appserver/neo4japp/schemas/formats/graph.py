import importlib.resources as resources
import json
from dataclasses import dataclass
from itertools import chain
from typing import Optional, Tuple, List, Literal, NamedTuple, Iterable, Dict

import fastjsonschema

from .utils import ContentValidationMessage, ContentValidationGroupedMessageFactory
from .. import formats

with resources.open_text(formats, 'graph_v6.json') as f:
    # Use this method to validate the content of an enrichment table
    validate_graph_format = fastjsonschema.compile(json.load(f))
    # used during migration to fix outdated json
    current_version = '6'


@dataclass(repr=False, frozen=True)
class ContentValidationNotDefinedSourceTargetMessage(ContentValidationMessage):
    message: Optional[str] = None
    additional_msgs: Tuple[str, ...] = tuple()


@dataclass(repr=False, eq=False)
class SparseTraceNetworkSourcesTargets(ContentValidationGroupedMessageFactory):
    source_target: Literal['sources', 'targets']

    class _SparseTraceNetworkSourcesTargets(NamedTuple):
        trace_network_idx: int
        trace_network_label: str
        missing_nodes: List[str]

    entity_type = _SparseTraceNetworkSourcesTargets

    def entity_messages(
        self, entity: _SparseTraceNetworkSourcesTargets
    ) -> Tuple[str, ...]:
        return (
            str(entity.missing_nodes),
            self.path('graph', 'trace_networks', entity.trace_network_idx),
        )

    def to_message(self):
        return ContentValidationNotDefinedSourceTargetMessage(
            message=self.compose(
                lambda entity: (
                    f'Trace network ({entity.trace_network_label}) nodes'
                    f' defined as {self.source_target} was not mapped into graph'
                ),
                lambda length: (
                    f'{length} trace networks contains nodes'
                    f' which were defined as {self.source_target} but were not mapped into graph'
                ),
            ),
            additional_msgs=(f'Offending node ids:', *self.entities_messages()),
        )


@dataclass(repr=False)
class NodeSetWithNonExistingNodes(ContentValidationGroupedMessageFactory):
    class _NodeSetNonExistingNodes(NamedTuple):
        node_set_name: str
        missing_nodes: Iterable[str]

    entity_type = _NodeSetNonExistingNodes

    def entity_messages(self, entity: _NodeSetNonExistingNodes) -> Tuple[str, ...]:
        return (
            str(list(entity.missing_nodes)),
            self.path('graph', 'node_sets', entity.node_set_name),
        )

    def to_message(self):
        return ContentValidationMessage(
            message=self.compose(
                lambda entity: (
                    f'Node set "{entity.node_set_name}" contains nodes that are not in the graph'
                ),
                lambda length: (
                    f'{length} node sets contains nodes that are not in the graph'
                ),
            ),
            additional_msgs=(f'Offending node ids:', *self.entities_messages()),
        )


@dataclass(repr=False)
class NonExistingNodeSet(ContentValidationGroupedMessageFactory):
    node_sets: List[str]
    source_target: Literal['sources', 'targets']

    class _MissingTraceNetworkSource(NamedTuple):
        trace_network_idx: int
        trace_network_label: str
        sources: str

    entity_type = _MissingTraceNetworkSource

    def entity_messages(self, entity: _MissingTraceNetworkSource) -> Tuple[str, ...]:
        return (
            f'Requested node set: {entity.sources}',
            self.path(
                'graph', 'trace_networks', entity.trace_network_idx, self.source_target
            ),
        )

    def to_message(self):
        return ContentValidationMessage(
            message=self.compose(
                lambda entity: (
                    f'Trace network ({entity.trace_network_label}) {self.source_target}'
                    f' points to non-existing node set'
                ),
                lambda length: (
                    f'{length} trace networks {self.source_target} property'
                    f' points to non-existing node set'
                ),
            ),
            additional_msgs=(
                f'Declared node sets: {self.node_sets}',
                *self.entities_messages(),
            ),
        )


@dataclass(repr=False)
class NonExistingDefaultSizing(ContentValidationGroupedMessageFactory):
    sizings: List[str]

    class _MissingTraceNetworkSource(NamedTuple):
        trace_network_idx: int
        trace_network_label: str
        default_sizing: str

    entity_type = _MissingTraceNetworkSource

    def entity_messages(self, entity: _MissingTraceNetworkSource) -> Tuple[str, ...]:
        return (
            f'Requested sizing: {entity.default_sizing}',
            self.path(
                'graph', 'trace_networks', entity.trace_network_idx, 'default_sizing'
            ),
        )

    def to_message(self):
        return ContentValidationMessage(
            message=self.compose(
                lambda entity: (
                    f'Default sizing for trace network ({entity.trace_network_label})'
                    f' is not in sizing list'
                ),
                lambda length: (
                    f'{length} trace networks has default sizing property'
                    f' is not in sizing list'
                ),
            ),
            additional_msgs=(
                f'Declared sizings: {self.sizings}',
                *self.entities_messages(),
            ),
        )


@dataclass(repr=False)
class NonExistingTraceNodes(ContentValidationGroupedMessageFactory):
    class _NonExistingTraceNodes(NamedTuple):
        trace_network_idx: int
        trace_idx: int
        trace_label: str
        missing_nodes: List[str]

    entity_type = _NonExistingTraceNodes

    def entity_messages(self, entity: _NonExistingTraceNodes) -> Tuple[str, ...]:
        return (
            f'Trace ({entity.trace_label}) offending nodes:' f'{entity.missing_nodes}',
            self.path(
                'graph',
                'trace_networks',
                entity.trace_network_idx,
                'traces',
                entity.trace_idx,
                'node_paths',
            ),
        )

    def to_message(self):
        return ContentValidationMessage(
            message=self.compose(
                lambda entity: (
                    f'Trace ({entity.trace_label}) contains nodes that are not in the graph'
                ),
                lambda length: (
                    f'{length} traces contains nodes that are not in the graph'
                ),
            ),
            additional_msgs=(*self.entities_messages(),),
        )


@dataclass(repr=False)
class NonExistingTraceLinks(ContentValidationGroupedMessageFactory):
    class _NonExistingTraceNodes(NamedTuple):
        trace_network_idx: int
        trace_idx: int
        missing_links: List[str]

    entity_type = _NonExistingTraceNodes

    def entity_messages(self, entity: _NonExistingTraceNodes) -> Tuple[str, ...]:
        return (
            f'Offending node ids: {entity.missing_links}',
            self.path(
                'graph',
                'trace_networks',
                entity.trace_network_idx,
                'traces',
                entity.trace_idx,
                'edges',
            ),
        )

    def to_message(self):
        return ContentValidationMessage(
            message=self.compose(
                lambda entity: (
                    f'Trace ({entity.trace_idx}) contains links that are not in the graph'
                ),
                lambda length: f'{length} traces contains links that are not in the graph',
            ),
            additional_msgs=(*self.entities_messages(),),
        )


@dataclass(repr=False)
class NonExistingTraceSourceTarget(ContentValidationGroupedMessageFactory):
    source_target: Literal['source', 'target']

    class _NonExistingTraceSourceTarget(NamedTuple):
        trace_network_idx: int
        trace_idx: int
        source_target: str

    entity_type = _NonExistingTraceSourceTarget

    def entity_messages(self, entity: _NonExistingTraceSourceTarget) -> Tuple[str, ...]:
        return (
            f"Offending node id: {entity.source_target}",
            self.path(
                'graph',
                'trace_networks',
                entity.trace_network_idx,
                'traces',
                entity.trace_idx,
                self.source_target,
            ),
        )

    def to_message(self):
        return ContentValidationMessage(
            message=self.compose(
                lambda entity: f'Trace {self.source_target} is not in the graph',
                lambda length: (
                    f'{length} traces has {self.source_target}s which are not in the graph'
                ),
            ),
            additional_msgs=(*self.entities_messages(),),
        )


@dataclass(repr=False)
class NonExistingTraceDetailEdge(ContentValidationGroupedMessageFactory):
    class _NonExistingTraceDetailEdge(NamedTuple):
        trace_network_idx: int
        trace_idx: int
        missing_links: List[str]

    entity_type = _NonExistingTraceDetailEdge

    def entity_messages(self, entity: _NonExistingTraceDetailEdge) -> Tuple[str, ...]:
        return (
            str(entity.missing_links),
            self.path(
                'graph',
                'trace_networks',
                entity.trace_network_idx,
                'traces',
                entity.trace_idx,
                'detail_edges',
            ),
        )

    def to_message(self):
        return ContentValidationMessage(
            message=self.compose(
                lambda entity: f'Trace detail edge contains links that are not in the graph',
                lambda length: (
                    f'{length} traces constains detail edge links that are not in the graph'
                ),
            ),
            additional_msgs=("Offending links:", *self.entities_messages()),
        )


@dataclass(repr=False)
class NonExistingLinkSourceTarget(ContentValidationGroupedMessageFactory):
    source_target: Literal['source', 'target']

    class _NonExistingTraceDetailEdge(NamedTuple):
        link_idx: int
        source_target: str
        other_node_label: str

    entity_type = _NonExistingTraceDetailEdge

    def entity_messages(self, entity: _NonExistingTraceDetailEdge) -> Tuple[str, ...]:
        graph_context = [
            'Missing',
            entity.link_idx,
            entity.other_node_label or "Missing",
        ]
        if self.source_target == 'target':
            graph_context = list(reversed(graph_context))
        return (
            f'Link with idx {entity.link_idx} has {self.source_target} {entity.source_target}'
            f' which is not in the graph',
            f'({graph_context[0]})-[{graph_context[1]}]→({graph_context[2]})',
            self.path('graph', 'links', entity.link_idx, self.source_target),
        )

    def to_message(self):
        return ContentValidationMessage(
            message=self.compose(
                lambda entity: f'Link {self.source_target} is not in the graph',
                lambda length: (
                    f'{length} links has {self.source_target}s which are not in the graph'
                ),
            ),
            additional_msgs=(*self.entities_messages(),),
        )


@dataclass(repr=False)
class NonExistingSizingProperties(ContentValidationGroupedMessageFactory):
    link_node: Literal['link', 'node']
    sizing_properties: List[str]

    class _NonExistingSizingProperties(NamedTuple):
        id: int
        label: str
        missing_properties: List[str]

    entity_type = _NonExistingSizingProperties

    def entity_messages(self, entity: _NonExistingSizingProperties) -> Tuple[str, ...]:
        return (
            f'{self.link_node.capitalize()}({entity.label}) has missing properties:'
            f'{entity.missing_properties}',
            self.path(
                'graph', f'{self.link_node}s', entity.id, entity.missing_properties
            ),
        )

    def to_message(self):
        return ContentValidationMessage(
            message=self.compose(
                lambda entity: (
                    f'{self.link_node.capitalize()}({entity.label}) is missing sizing properties'
                ),
                lambda length: (
                    f'{length} {self.link_node}s are missing sizing properties'
                ),
            ),
            additional_msgs=(
                f'{self.link_node.capitalize()} sizing properties: {self.sizing_properties}',
                *self.entities_messages(),
            ),
        )


@dataclass(repr=False)
class HasReservedProperties(ContentValidationGroupedMessageFactory):
    link_node: Literal['link', 'node']

    class _HasReservedProperties(NamedTuple):
        id: int
        label: str
        reserved_properties: List[str]

    entity_type = _HasReservedProperties

    def entity_messages(self, entity: _HasReservedProperties) -> Tuple[str, ...]:
        return (
            f'{self.link_node.capitalize()}({entity.label}) contains properties'
            f' reserved for internal use:',
            f'{entity.reserved_properties}',
            self.path(
                'graph', f'{self.link_node}s', entity.id, entity.reserved_properties
            ),
        )

    def to_message(self):
        return ContentValidationMessage(
            message=self.compose(
                lambda entity: (
                    f'{self.link_node.capitalize()}({entity.label}) additional properties'
                    f' cannot start with underscore'
                ),
                lambda length: f'{length} {self.link_node}s are missing sizing properties',
            ),
            additional_msgs=(
                f'Properties starting with \'_\' are reserved for internal use',
                *self.entities_messages(),
            ),
        )


def _get_trace_network_label(trace_network):
    description = trace_network.get("description")
    if description:
        return f"\"{description}\""
    return f"\"{trace_network.get('sources')}\" → \"{trace_network.get('targets')}\""


def validate_graph_content(data):
    """
    Makes references and sanity checks on graph data
    :param data: graph data
    :return: void (yields exceptions if invalid)
    """
    graph = data['graph']
    trace_networks = graph['trace_networks']
    node_sets = graph['node_sets']
    sizings = graph.get('sizing', {})
    nodes = data['nodes']
    links = data['links']
    links_length = len(links)
    #   if not links_length:
    #       yield ContentValidationMessage(message='Graph has no links!')
    if not len(nodes):
        yield ContentValidationMessage(message='Graph has no nodes')
    if not len(trace_networks):
        yield ContentValidationMessage(message='Graph has no trace networks')

    node_id_map = {node['id']: node for node in nodes}
    node_ids = node_id_map.keys()

    def _get_label(entity: Dict):
        # Node
        display_name = entity.get('displayName')
        if display_name:
            return f"\"{display_name}\""
        # Link
        source = node_id_map.get(entity.get('source'))
        target = node_id_map.get(entity.get('target'))
        if source and target:
            return f"{_get_label(source)} → {_get_label(target)}"
        # Anything
        return f"\"{entity.get('label', '')}\""

    def valid_link_idx(link_idx):
        return (0 <= link_idx) and (link_idx < links_length)

    node_set_with_non_existing_nodes = NodeSetWithNonExistingNodes()
    for node_set_name, node_set in node_sets.items():
        if not set(node_set).issubset(node_ids):
            node_set_with_non_existing_nodes.append(
                node_set_with_non_existing_nodes.entity_type(
                    node_set_name, set(node_set) - node_ids
                )
            )
    if node_set_with_non_existing_nodes:
        yield node_set_with_non_existing_nodes.to_message()
    del node_set_with_non_existing_nodes

    non_existing_source_node_set = NonExistingNodeSet(node_sets.keys(), 'sources')
    non_existing_target_node_set = NonExistingNodeSet(node_sets.keys(), 'targets')
    sparse_trace_network_sources = SparseTraceNetworkSourcesTargets('sources')
    sparse_trace_network_targets = SparseTraceNetworkSourcesTargets('targets')
    non_existing_default_sizing = NonExistingDefaultSizing(list(sizings.keys()))
    non_existing_trace_nodes = NonExistingTraceNodes()
    non_existing_trace_links = NonExistingTraceLinks()
    non_existing_trace_source = NonExistingTraceSourceTarget('source')
    non_existing_trace_target = NonExistingTraceSourceTarget('target')
    non_existing_trace_detail_edge = NonExistingTraceDetailEdge()
    for trace_network_idx, trace_network in enumerate(trace_networks):
        sources = trace_network['sources']
        targets = trace_network['sources']
        trace_network_nodes = set(
            chain.from_iterable(
                chain.from_iterable(
                    map(lambda t: t['node_paths'], trace_network['traces'])
                )
            )
        )

        if sources not in node_sets:
            non_existing_source_node_set.append(
                non_existing_source_node_set.entity_type(
                    trace_network_idx, _get_trace_network_label(trace_network), sources
                )
            )
        else:
            sources_ids = node_sets[sources]
            if not set(sources_ids).issubset(trace_network_nodes):
                sparse_trace_network_sources.append(
                    sparse_trace_network_sources.entity_type(
                        trace_network_idx,
                        _get_trace_network_label(trace_network),
                        list(set(sources_ids) - trace_network_nodes),
                    )
                )

        if targets not in node_sets:
            non_existing_target_node_set.append(
                non_existing_target_node_set.entity_type(
                    trace_network_idx, _get_trace_network_label(trace_network), targets
                )
            )
        else:
            targets_ids = node_sets[targets]
            if not set(targets_ids).issubset(trace_network_nodes):
                sparse_trace_network_targets.append(
                    sparse_trace_network_targets.entity_type(
                        trace_network_idx,
                        _get_trace_network_label(trace_network),
                        list(set(targets_ids) - trace_network_nodes),
                    )
                )
        default_sizing = trace_network.get('default_sizing')
        if default_sizing and (default_sizing not in sizings):
            non_existing_default_sizing.append(
                non_existing_default_sizing.entity_type(
                    trace_network_idx,
                    _get_trace_network_label(trace_network),
                    default_sizing,
                )
            )
        for trace_idx, trace in enumerate(trace_network['traces']):
            node_path_sets = map(set, trace['node_paths'])
            missing_nodes = (
                set(
                    chain.from_iterable(
                        [
                            node_path_set
                            for node_path_set in node_path_sets
                            if not node_path_set.issubset(node_ids)
                        ]
                    )
                )
                - node_ids
            )
            if missing_nodes:
                non_existing_trace_nodes.append(
                    non_existing_trace_nodes.entity_type(
                        trace_network_idx,
                        trace_idx,
                        _get_label(trace),
                        list(missing_nodes),
                    )
                )
            missing_links = [
                link_idx for link_idx in trace['edges'] if not valid_link_idx(link_idx)
            ]
            if missing_links:
                non_existing_trace_links.append(
                    non_existing_trace_links.entity_type(
                        trace_network_idx, trace_idx, missing_links
                    )
                )
            if trace['source'] not in node_ids:
                non_existing_trace_source.append(
                    non_existing_trace_source.entity_type(
                        trace_network_idx, trace_idx, trace['source']
                    )
                )
            if trace['target'] not in node_ids:
                non_existing_trace_target.append(
                    non_existing_trace_target.entity_type(
                        trace_network_idx, trace_idx, trace['target']
                    )
                )
            detail_edges = chain.from_iterable(
                [detail_edge[:2] for detail_edge in trace.get('detail_edges', [])]
            )
            missing_links = [
                link_idx for link_idx in detail_edges if not valid_link_idx(link_idx)
            ]
            if missing_links:
                non_existing_trace_detail_edge.append(
                    non_existing_trace_detail_edge.entity_type(
                        trace_network_idx, trace_idx, missing_links
                    )
                )
    for check_result in (
        non_existing_source_node_set,
        non_existing_target_node_set,
        sparse_trace_network_sources,
        sparse_trace_network_targets,
        non_existing_default_sizing,
        non_existing_trace_nodes,
        non_existing_trace_links,
        non_existing_trace_source,
        non_existing_trace_target,
        non_existing_trace_detail_edge,
    ):
        if check_result:
            yield check_result.to_message()
        del check_result

    sizing_node_properties = set()
    sizing_link_properties = set()
    for sizing in sizings.values():
        if sizing['node_sizing']:
            sizing_node_properties.add(sizing['node_sizing'])
        if sizing['link_sizing']:
            sizing_link_properties.add(sizing['link_sizing'])

    non_existing_link_source = NonExistingLinkSourceTarget('source')
    non_existing_link_target = NonExistingLinkSourceTarget('target')
    non_existing_sizing_properties = NonExistingSizingProperties(
        'link', list(sizing_link_properties)
    )
    has_reserved_properties = HasReservedProperties('link')
    for idx, link in enumerate(links):
        if link['source'] not in node_ids:
            non_existing_link_source.append(
                non_existing_link_source.entity_type(
                    idx, link['source'], node_id_map.get(link['target'])
                )
            )
        if link['target'] not in node_ids:
            non_existing_link_target.append(
                non_existing_link_target.entity_type(
                    idx, link['target'], node_id_map.get(link['source'])
                )
            )
        missing_properties = [
            prop for prop in sizing_link_properties if prop not in link
        ]
        if missing_properties:
            non_existing_sizing_properties.append(
                non_existing_sizing_properties.entity_type(
                    idx, _get_label(link), missing_properties
                )
            )
        reserved_properties = [
            prop for prop in sizing_link_properties if prop.startswith('_')
        ]
        if reserved_properties:
            has_reserved_properties.append(
                has_reserved_properties.entity_type(
                    idx, _get_label(link), reserved_properties
                )
            )
    for check_result in (
        non_existing_link_source,
        non_existing_link_target,
        non_existing_sizing_properties,
        has_reserved_properties,
    ):
        if check_result:
            yield check_result.to_message()
        del check_result

    non_existing_sizing_properties = NonExistingSizingProperties(
        'node', list(sizing_node_properties)
    )
    has_reserved_properties = HasReservedProperties('node')
    for node in nodes:
        missing_properties = [
            prop for prop in sizing_node_properties if prop not in node
        ]
        if missing_properties:
            non_existing_sizing_properties.append(
                non_existing_sizing_properties.entity_type(
                    node.get("id"), _get_label(node), missing_properties
                )
            )
        reserved_properties = [
            prop for prop in sizing_node_properties if prop.startswith('_')
        ]
        if reserved_properties:
            has_reserved_properties.append(
                has_reserved_properties.entity_type(
                    node.get("id"), _get_label(node), reserved_properties
                )
            )
    for check_result in (non_existing_sizing_properties, has_reserved_properties):
        if check_result:
            yield check_result.to_message()
        del check_result
