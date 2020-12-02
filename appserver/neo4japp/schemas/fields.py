import re
from typing import Optional, Dict

from marshmallow import fields, ValidationError

from neo4japp.utils.request import parse_sort


class SortField(fields.String):
    _deserialize_pattern = re.compile('^((?:[+-])?)(.*)$', re.S)
    value_to_column: Dict
    column_to_value: Dict

    def __init__(self, *args, columns: Dict, **kwargs):
        super().__init__(*args, **kwargs)
        self.value_to_column = dict(columns)
        self.column_to_value = dict((reversed(item) for item in self.value_to_column.items()))

    def _serialize(self, value: Optional, attr, obj, **kwargs):
        raise NotImplementedError('not implemented yet')

    def _deserialize(self, *args, **kwargs):
        value: Optional[str] = super()._serialize(*args, **kwargs)
        if value is None:
            return []
        else:
            try:
                return parse_sort(value, self.value_to_column, '')
            except ValueError as e:
                raise ValidationError(str(e))
