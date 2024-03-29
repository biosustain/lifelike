from typing import List

from flask import current_app

from neo4japp.constants import LogEventType, DATA_SOURCES, DISPLAY_NAME_MAP
from neo4japp.exceptions import ServerWarning
from neo4japp.utils import EventLog
from neo4japp.utils.globals import warn


def get_first_known_label_from_node(node):
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


def get_known_domain_labels_from_data_source(data_source: str):
    return [DATA_SOURCES[data_source]] if data_source in DATA_SOURCES else []
