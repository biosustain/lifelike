import importlib.resources as resources
import json
from itertools import chain

import fastjsonschema

from .. import formats

# noinspection PyTypeChecker
from ...exceptions import ContentValidationError

with resources.open_text(formats, "graph_v6.json") as f:
    # Use this method to validate the content of an enrichment table
    validate_graph_format = fastjsonschema.compile(json.load(f))
    # used during migration to fix outdated json
    current_version = "6"


def validate_graph_content(data):
    """
    Makes references and sanity checks on graph data
    :param data: graph data
    :return: void (yields exceptions if invalid)
    """
    graph = data["graph"]
    trace_networks = graph["trace_networks"]
    node_sets = graph["node_sets"]
    sizings = graph.get("sizing", {})
    nodes = data["nodes"]
    links = data["links"]
    links_length = len(links)
    #   if not links_length:
    #       yield ContentValidationError(message='Graph has no links!')
    if not len(nodes):
        yield ContentValidationError(message="Graph has no nodes!")
    if not len(trace_networks):
        yield ContentValidationError(message="Graph has no trace networks!")

    node_ids = set([node["id"] for node in nodes])

    def valid_link_idx(idx):
        return (0 <= idx) and (idx < links_length)

    for node_set_name, node_set in node_sets.items():
        if not set(node_set).issubset(node_ids):
            yield ContentValidationError(
                message=f'Node set "{node_set_name}" contains nodes that are not in the graph!',
                additional_msgs=(
                    f"Offending node ids:",
                    str(set(node_set) - node_ids),
                    f"Path: graph.node_sets.{node_set_name}",
                ),
            )
    for trace_network_idx, trace_network in enumerate(trace_networks):
        sources = trace_network["sources"]
        targets = trace_network["sources"]
        trace_network_nodes = set(
            chain.from_iterable(
                chain.from_iterable(
                    map(lambda t: t["node_paths"], trace_network["traces"])
                )
            )
        )

        if sources not in node_sets:
            yield ContentValidationError(
                message=f"Trace network ({trace_network_idx})"
                f" sources points to non-existing node set!",
                additional_msgs=(
                    f"Declared node sets: {list(node_sets.keys())}",
                    f"Requested node set: {sources}",
                    f"Path: graph.trace_networks.{trace_network_idx}.sources",
                ),
            )
        else:
            sources_ids = node_sets[sources]
            if not set(sources_ids).issubset(trace_network_nodes):
                yield ContentValidationError(
                    message="Trace network source contains nodes that are not in it!",
                    additional_msgs=(
                        f"Offending node ids: {set(sources_ids) - trace_network_nodes}",
                        f"Path: graph.trace_networks.{trace_network_idx}",
                    ),
                )

        if targets not in node_sets:
            yield ContentValidationError(
                message=f"Trace network ({trace_network_idx})"
                f" targets points to non-existing node set!",
                additional_msgs=(
                    f"Declared node sets: {list(node_sets.keys())}",
                    f"Requested node set: {targets}",
                    f"Path: graph.trace_networks.{trace_network_idx}.targets",
                ),
            )
        else:
            targets_ids = node_sets[targets]
            if not set(targets_ids).issubset(trace_network_nodes):
                yield ContentValidationError(
                    message="Trace network source contains nodes that are not in it!",
                    additional_msgs=(
                        f"Offending node ids: {set(targets_ids) - trace_network_nodes}",
                        f"Path: graph.trace_networks.{trace_network_idx}",
                    ),
                )
        default_sizing = trace_network.get("default_sizing")
        if default_sizing and (default_sizing not in sizings):
            yield ContentValidationError(
                message="Default sizing for trace network is not in sizing list!",
                additional_msgs=(
                    f"Declared sizings: {list(sizings.keys())}",
                    f"Requested sizing: {default_sizing}",
                    f"Path: graph.trace_networks.{trace_network_idx}.default_sizing",
                ),
            )
        for trace_idx, trace in enumerate(trace_network["traces"]):
            for node_path in trace["node_paths"]:
                if not set(node_path).issubset(node_ids):
                    yield ContentValidationError(
                        message="Trace contains nodes that are not in the graph!",
                        additional_msgs=(
                            f"Offending node ids: {set(node_path) - node_ids}",
                            f"Path: graph.trace_networks.{trace_network_idx}.traces."
                            f"{trace_idx}.node_paths",
                        ),
                    )
            for link_idx in trace["edges"]:
                if not valid_link_idx(link_idx):
                    yield ContentValidationError(
                        message="Trace edge contains links that are not in the graph!",
                        additional_msgs=(
                            f"Offending link: {link_idx}",
                            f"Path: graph.trace_networks.{trace_network_idx}.traces."
                            f"{trace_idx}.edges",
                        ),
                    )
            if trace["source"] not in node_ids:
                yield ContentValidationError(
                    message="Trace source is not in the graph!",
                    additional_msgs=(
                        f"Offending node id: {trace['source']}",
                        f"Path: graph.trace_networks.{trace_network_idx}.traces."
                        f"{trace_idx}.source",
                    ),
                )
            if trace["target"] not in node_ids:
                yield ContentValidationError(
                    message="Trace target is not in the graph!",
                    additional_msgs=(
                        f"Offending node id: {trace['target']}",
                        f"Path: graph.trace_networks.{trace_network_idx}.traces."
                        f"{trace_idx}.target",
                    ),
                )
            for detail_edge in trace.get("detail_edges", []):
                for link_idx in detail_edge[:2]:
                    if not valid_link_idx(link_idx):
                        yield ContentValidationError(
                            message="Trace detail edge contains links that are not in the graph!",
                            additional_msgs=(
                                f"Offending link: {link_idx}",
                                f"Path: graph.trace_networks.{trace_network_idx}.traces."
                                f"{trace_idx}.detail_edges",
                            ),
                        )
    sizing_node_properties = set()
    sizing_link_properties = set()
    for sizing in sizings.values():
        if sizing["node_sizing"]:
            sizing_node_properties.add(sizing["node_sizing"])
        if sizing["link_sizing"]:
            sizing_link_properties.add(sizing["link_sizing"])

    raised = dict()
    for idx, link in enumerate(links):
        if link["source"] not in node_ids:
            yield ContentValidationError(
                message="Link source is not in the graph!",
                additional_msgs=(
                    f'Link with idx {idx} has source {link["source"]} which is not in the '
                    f"graph!",
                    f"Path: graph.links.{idx}.source",
                ),
            )
        if link["target"] not in node_ids:
            yield ContentValidationError(
                message="Link target is not in the graph!",
                additional_msgs=(
                    f'Link with idx {idx} has target {link["target"]} which is not in the '
                    f"graph!",
                    f"Path: graph.links.{idx}.target",
                ),
            )
        for prop in sizing_link_properties:
            if prop not in link:
                if prop not in raised:
                    raised[prop] = ContentValidationError(
                        message="Link has no sizing property!",
                        additional_msgs=(
                            f"Link sizing properties: {list(sizing_link_properties)}",
                            f"Link with idx {idx} has no property {prop}!",
                            f"Path: graph.links.{idx}.{prop}",
                        ),
                    )
                    yield raised[prop]
                else:
                    raised[prop].additional_msgs = (
                        *raised[prop].additional_msgs,
                        f"Path: graph.links.{idx}.{prop}",
                    )
        for prop in link:
            if prop.startswith("_"):
                if prop not in raised:
                    raised[prop] = ContentValidationError(
                        message="Additional properties cannot start with underscore!",
                        additional_msgs=(
                            f"Link with idx {idx} has property ({prop}) with reserved property "
                            f"prefix '_'.",
                            f"Path: graph.links.{idx}.{prop}",
                        ),
                    )
                    yield raised[prop]
                else:
                    raised[prop].additional_msgs = (
                        *raised[prop].additional_msgs,
                        f"Path: graph.links.{idx}.{prop}",
                    )
    raised = dict()
    for node in nodes:
        for prop in sizing_node_properties:
            if prop not in node:
                if prop not in raised:
                    raised[prop] = ContentValidationError(
                        message="Node has no sizing property!",
                        additional_msgs=(
                            f"Node sizing properties: {list(sizing_node_properties)}",
                            f'Node with id {node.get("id")} has no property {prop}!',
                            f'Path: graph.nodes.{node.get("id")}.{prop}',
                        ),
                    )
                    yield raised[prop]
                else:
                    raised[prop].additional_msgs = (
                        *raised[prop].additional_msgs,
                        f'Path: graph.nodes.{node.get("id")}.{prop}',
                    )
        for prop in node:
            if prop.startswith("_"):
                if prop not in raised:
                    raised[prop] = ContentValidationError(
                        message="Additional properties cannot start with underscore!",
                        additional_msgs=(
                            f'Node with id {node.get("id")} has property ({prop}) with reserved '
                            f"property prefix '_'.",
                            f'Path: graph.nodes.{node.get("id")}.{prop}',
                        ),
                    )
                    yield raised[prop]
                else:
                    raised[prop].additional_msgs = (
                        *raised[prop].additional_msgs,
                        f'Path: graph.nodes.{node.get("id")}.{prop}',
                    )
