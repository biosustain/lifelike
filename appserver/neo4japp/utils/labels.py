from typing import List

from flask import current_app
from neo4j.graph import Node as N4jDriverNode

from neo4japp.constants import LogEventType, DISPLAY_NAME_MAP, DOMAIN_LABELS
from neo4japp.exceptions import ServerWarning
from neo4japp.utils import EventLog
from neo4japp.utils.globals import warn


def get_first_known_label_from_node(node: N4jDriverNode):
    try:
        return get_first_known_label_from_list(node.labels)
    except ValueError as e:
        message = (
            f'Node with ID {node.id} had an unexpected list of labels: {node.labels}'
        )
        current_app.logger.warning(
            message,
            extra=EventLog(event_type=LogEventType.KNOWLEDGE_GRAPH.value).to_dict(),
        )
        warn(ServerWarning(message=message), cause=e)
        return 'Unknown'


def get_first_known_label_from_list(labels: List[str]):
    for label in labels:
        if label in DISPLAY_NAME_MAP.keys():
            return label
    raise ValueError('Detected node label of an unknown type!')


def get_known_domain_labels_from_node(node: N4jDriverNode):
    return get_known_domain_labels_from_list(node.labels)


def get_known_domain_labels_from_list(labels: List[str]):
    domain_labels = []

    for label in labels:
        if label in DOMAIN_LABELS:
            domain_labels.append(label)

    return domain_labels
