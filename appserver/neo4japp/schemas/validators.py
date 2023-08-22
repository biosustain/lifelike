import typing
from typing import Callable, Iterable, Union

import fastjsonschema
import marshmallow.validate
from marshmallow import ValidationError


# noinspection PyMissingConstructor
class DeferedOneOf(marshmallow.validate.OneOf):
    choices_callback: Callable[[], Iterable]

    def __init__(
        self,
        choices_callback: Callable[[], Iterable],
        labels: Union[Iterable[str], None] = None,
        *,
        error: Union[str, None] = None,
    ):
        self.choices_callback = choices_callback
        self.labels = labels if labels is not None else []
        self.labels_text = ", ".join(str(label) for label in self.labels)
        self.error = error or self.default_message  # type: str

    @property
    def choices(self):
        return self.choices_callback()

    @property
    def choices_text(self):
        """Choices is dynamic list so does choices_text need to be"""
        return ", ".join(str(choice) for choice in self.choices)


class JSONSchema(marshmallow.validate.Validator):
    """Validator checking if value is valid json schema."""

    def __call__(self, value: typing.Any) -> typing.Any:
        try:
            fastjsonschema.compile(value)
        except TypeError as error:
            raise ValidationError("Parameter must be valid json schema") from error

        return value
