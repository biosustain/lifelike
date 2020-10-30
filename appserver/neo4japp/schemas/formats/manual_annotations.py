import importlib.resources as resources
import json

import fastjsonschema

from .. import formats

with resources.open_text(formats, 'annotation_inclusion_v1.json') as f:
    validate_inclusion = fastjsonschema.compile(json.load(f))

with resources.open_text(formats, 'annotation_exclusion_v1.json') as f:
    validate_exclusion = fastjsonschema.compile(json.load(f))
