from string import Template
from typing import Optional


class TemplateDescriptor:
    def __init__(self, *, default: str):
        self._default_template = Template(default)

    def __set_name__(self, owner, name):
        self._name = "_" + name

    def __get__(self, obj, type) -> Optional[str]:
        if obj is None:
            return None

        return getattr(
            obj,
            self._name,
            self._default_template.substitute(obj)
        )

    def __set__(self, obj, value: Optional[str]):
        setattr(obj, self._name, value)
