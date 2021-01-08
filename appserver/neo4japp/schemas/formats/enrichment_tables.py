import importlib.resources as resources
import json

import fastjsonschema

from .. import formats

# noinspection PyTypeChecker
with resources.open_text(formats, 'enrichment_tables_v1.json') as f:
    validate_enrichment_table = fastjsonschema.compile(json.load(f))
