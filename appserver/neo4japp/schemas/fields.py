import re
from typing import Optional, Dict

import sqlalchemy
from marshmallow import fields, ValidationError

from neo4japp.utils.request import parse_sort


class StringIntegerField(fields.Integer):
    """An integer field that also handles the case when the data is an empty string."""
    def _deserialize(self, value, attr, data, **kwargs):
        if value == '':
            if self.missing is not None:
                value = self.missing() if callable(self.missing) else self.missing
            elif not self.allow_none:
                self.fail('null')
            else:
                return None
        return super()._deserialize(value, attr, data)


class SortField(fields.String):
    _deserialize_pattern = re.compile('^((?:[+-])?)(.*)$', re.S)
    value_to_column: Dict

    def __init__(self, *args, columns: Dict, **kwargs):
        super().__init__(*args, **kwargs)
        self.value_to_column = dict(columns)

    def _serialize(self, value, attr, obj, **kwargs):
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
