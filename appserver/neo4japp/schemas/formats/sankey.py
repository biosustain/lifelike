import importlib.resources as resources
import json

import fastjsonschema

from .. import formats

# noinspection PyTypeChecker
with resources.open_text(formats, 'sankey_v3.json') as f:
    # Use this method to validate the content of an enrichment table
    validate_sankey = fastjsonschema.compile(json.load(f))
    # used during migration to fix outdated json
    current_version = '3'
