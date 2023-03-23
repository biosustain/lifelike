from dataclasses import asdict
from string import Template
from typing import Optional


class TemplateDescriptor:
    _default: str
    _default_template: Template
    _property_prefix: str
    _nested_call: bool = False

    def __init__(self, *, default: str, property_prefix: str = '_'):
        self._default = default
        self._default_template = Template(default)
        self._property_prefix = property_prefix

    def __set_name__(self, owner, name):
        self._name = name

    def __enter__(self):
        self._nested_call = True

    def __exit__(self, exc_type, exc_val, exc_tb):
        self._nested_call = False

    def __get__(self, obj, type) -> Optional[str]:
        # Init descriptor - return to indicate that it has default of type of returned value
        if obj is None:
            return self._default

        # Since was try to access properties of object to render object property
        # we would be facing recursion issues, instead we default requirsive calls to return None
        if self._nested_call:
            return None

        # Usser set manually value for the field
        if hasattr(obj, self._prefixed_name):
            return getattr(obj, self._prefixed_name)

        # Generate default value using template
        with self:
            return self._default_template.substitute(asdict(obj))

    @property
    def _prefixed_name(self):
        return self._property_prefix + self._name

    def __set__(self, obj, value: Optional[str]):
        if value != self._default:
            if hasattr(obj, self._prefixed_name):
                getattr(obj, self._prefixed_name).__set__(value)
            else:
                obj.__dict__[self._prefixed_name] = value
