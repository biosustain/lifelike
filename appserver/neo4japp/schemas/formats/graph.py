import importlib.resources as resources
import json

import fastjsonschema

from .. import formats

# noinspection PyTypeChecker
from ...exceptions import ContentValidationError

with resources.open_text(formats, 'graph_v6.json') as f:
    # Use this method to validate the content of an enrichment table
    validate_graph_format = fastjsonschema.compile(json.load(f))
    # used during migration to fix outdated json
    current_version = '6'


def validate_graph_content(data):
    """
    Makes references and sanity checks on graph data
    :param data: graph data
    :return: void (raises exception if invalid)
    """
    graph = data['graph']
    trace_networks = graph['trace_networks']
    node_sets = graph['node_sets']
    sizings = graph.get('sizing', {})
    nodes = data['nodes']
    links = data['links']
    links_length = len(links)
#   if not links_length:
#       raise ContentValidationError('Graph has no links!')
    if not len(nodes):
        raise ContentValidationError('Graph has no nodes!')
    if not len(trace_networks):
        raise ContentValidationError('Graph has no trace networks!')
    node_ids = set([node['id'] for node in nodes])

    def valid_link_idx(idx):
        return 0 <= idx < links_length

    for node_set_name, node_set in node_sets.items():
        if not set(node_set).issubset(node_ids):
            raise ContentValidationError(
                f'Node set "{node_set_name}" contains nodes that are not in the graph!',
                [
                    f'Offending node ids:', (set(node_set) - node_ids),
                    f'Path: graph.node_sets.{node_set_name}'
                ]
            )
    for trace_network_idx, trace_network in enumerate(trace_networks):
        if trace_network['sources'] not in node_sets:
            raise ContentValidationError(
                f'Trace network ({trace_network_idx}) sources points to non-existing node set!',
                [
                    'Declared node sets:', list(node_sets.keys()),
                    'Requested node set:', trace_network["sources"],
                    f'Path: graph.trace_networks.{trace_network_idx}.sources'
                ]
            )
        if trace_network['targets'] not in node_sets:
            raise ContentValidationError(
                f'Trace network ({trace_network_idx}) targets points to non-existing node set!',
                [
                    'Declared node sets:', list(node_sets.keys()),
                    'Requested node set:', trace_network["targets"],
                    f'Path: graph.trace_networks.{trace_network_idx}.targets'
                ]
            )
        default_sizing = trace_network.get('default_sizing')
        if default_sizing and (default_sizing not in sizings):
            raise ContentValidationError(
                'Default sizing for trace network is not in sizing list!',
                [
                    'Declared sizings:', list(sizings.keys()),
                    'Requested sizing:', default_sizing,
                    f'Path: graph.trace_networks.{trace_network_idx}.default_sizing'
                ]
            )
        for trace_idx, trace in enumerate(trace_network['traces']):
            for node_path in trace['node_paths']:
                if not set(node_path).issubset(node_ids):
                    raise ContentValidationError(
                        'Trace contains nodes that are not in the graph!',
                        [
                            f'Offending node ids:', (set(node_path) - node_ids),
                            f'Path: graph.trace_networks.{trace_network_idx}.traces.'
                            f'{trace_idx}.node_paths'
                        ]
                    )
            for link_idx in trace['edges']:
                if not valid_link_idx(link_idx):
                    raise ContentValidationError(
                        'Trace edge contains links that are not in the graph!',
                        [
                            'Offending link:', link_idx,
                            f'Path: graph.trace_networks.{trace_network_idx}.traces.'
                            f'{trace_idx}.edges'
                        ]
                    )
            if trace['source'] not in node_ids:
                raise ContentValidationError(
                    'Trace source is not in the graph!',
                    [
                        f'Offending node id:', trace['source'],
                        f'Path: graph.trace_networks.{trace_network_idx}.traces.'
                        f'{trace_idx}.source'
                    ]
                )
            if trace['target'] not in node_ids:
                raise ContentValidationError(
                    'Trace target is not in the graph!',
                    [
                        f'Offending node id:', trace['target'],
                        f'Path: graph.trace_networks.{trace_network_idx}.traces.'
                        f'{trace_idx}.target'
                    ]
                )
            for detail_edge in trace.get('detail_edges', []):
                for link_idx in detail_edge:
                    if not valid_link_idx(link_idx):
                        raise ContentValidationError(
                            'Trace detail edge contains links that are not in the graph!',
                            [
                                'Offending link:', link_idx,
                                f'Path: graph.trace_networks.{trace_network_idx}.traces.'
                                f'{trace_idx}.detail_edges'
                            ]
                        )
    sizing_node_properties = set()
    sizing_link_properties = set()
    for sizing in sizings:
        if sizing['node_sizing']:
            sizing_node_properties.add(sizing['node_sizing'])
        if sizing['link_sizing']:
            sizing_link_properties.add(sizing['link_sizing'])
    for idx, link in enumerate(links):
        if link['source'] not in node_ids:
            raise ContentValidationError(
                'Link source is not in the graph!',
                [
                    f'Link with idx {idx} has source {link["source"]} which is not in the '
                    f'graph!',
                    f'Path: graph.links.{idx}.source'
                ]
            )
        if link['target'] not in node_ids:
            raise ContentValidationError(
                'Link target is not in the graph!',
                [
                    f'Link with idx {idx} has target {link["target"]} which is not in the '
                    f'graph!',
                    f'Path: graph.links.{idx}.target'
                ]
            )
        for prop in sizing_link_properties:
            if prop not in link:
                raise ContentValidationError(
                    'Link has no sizing property!',
                    [
                        'Link sizing properties:', list(sizing_link_properties),
                        f'Link with idx {idx} has no property {prop}!',
                        f'Path: graph.links.{idx}.{prop}'
                    ]
                )
        for prop in link:
            if prop.startswith('_'):
                raise ContentValidationError(
                    'Additional properties cannot start with underscore!',
                    [
                        f'Link with idx {idx} has property ({prop}) with reserved property '
                        f'prefix \'_\'.',
                        f'Path: graph.links.{idx}.{prop}'
                    ]
                )
    for node in nodes:
        for prop in sizing_node_properties:
            if prop not in node:
                raise ContentValidationError(
                    'Node has no sizing property!',
                    [
                        'Node sizing properties:', list(sizing_node_properties),
                        f'Node with id {node.get("id")} has no property {prop}!',
                        f'Path: graph.nodes.{node.get("id")}.{prop}'
                    ]
                )
        for prop in node:
            if prop.startswith('_'):
                raise ContentValidationError(
                    'Additional properties cannot start with underscore!',
                    [
                        f'Node with id {node.get("id")} has property ({prop}) with reserved '
                        f'property prefix \'_\'.',
                        f'Path: graph.nodes.{node.get("id")}.{prop}'
                    ]
                )
