import importlib.resources as resources
import json

import fastjsonschema

from .. import formats

# noinspection PyTypeChecker
with resources.open_text(formats, 'map_v1.json') as f:
    validate_map = fastjsonschema.compile(json.load(f))


def validate_map_data(buffer):
    graph = json.loads(buffer.getvalue())
    validate_map(graph)
