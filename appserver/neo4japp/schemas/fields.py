import re
from typing import Optional, Dict

import sqlalchemy
from marshmallow import fields, ValidationError


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
