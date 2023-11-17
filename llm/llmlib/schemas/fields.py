from typing import Iterable

from marshmallow import fields, ValidationError


class UnionType(fields.Field):
    def __init__(self, *args, types: Iterable[fields.Field], **kwargs):
        super().__init__(*args, **kwargs)
        self.types = types

    def _deserialize(self, value, attr, data, **kwargs):
        for field_type in self.types:
            try:
                return field_type.deserialize(value)
            except ValidationError:
                pass
        raise ValidationError('Value does not match any of the types!')
