import re
from typing import Optional, Dict

import sqlalchemy
from marshmallow import fields, ValidationError


class SortField(fields.String):
    _deserialize_pattern = re.compile('^((?:[+-])?)(.*)$', re.S)
    value_to_column: Dict
    column_to_value: Dict

    def __init__(self, *args, columns: Dict, **kwargs):
        super().__init__(*args, missing=lambda: self._identity, **kwargs)
        self.value_to_column = dict(columns)
        self.column_to_value = dict((reversed(item) for item in self.value_to_column.items()))

    def _serialize(self, value: Optional, attr, obj, **kwargs):
        raise NotImplementedError('not implemented yet')

    def _deserialize(self, *args, **kwargs):
        value: Optional[str] = super()._serialize(*args, **kwargs)
        if value is None:
            return self._identity
        else:
            m = self._deserialize_pattern.match(value)
            desc = m.group(1) == '-'
            dir_func = sqlalchemy.desc if desc else sqlalchemy.asc
            field_name = m.group(2)
            if field_name in self.value_to_column:
                column = self.value_to_column[field_name]
                return [dir_func(column)]
            else:
                raise ValidationError(f'Unknown sort field \'{field_name}\'')

    def _identity(self, query):
        return query
