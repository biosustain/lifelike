from dataclasses import MISSING, fields
from string import Template
from typing import Generic, Callable, overload, Any, TypeVar, Union, Mapping

Obj = TypeVar('Obj')
T = TypeVar('T')


class Descriptor(Generic[Obj, T]):
    _property_prefix: str
    _name: str

    def __init__(self, property_prefix: str = '_descriptor_'):
        self._property_prefix = property_prefix

    def __set_name__(self, owner, name):
        self._name = name

    @property
    def _prefixed_name(self):
        return self._property_prefix + self._name

    @overload
    def __get__(self, instance: None, owner: type[Obj]) -> T:
        """This is happening when dataclass is being created"""
        ...

    @overload
    def __get__(self, instance: Obj, owner: type[Obj]) -> T:
        ...

    def __get__(self, instance: Union[Obj, None], owner: type[Obj]) -> T:
        return getattr(instance, self._prefixed_name, MISSING)  # type: ignore

    def _update_value(self, instance: Obj, value: T):
        setattr(instance, self._prefixed_name, value)

    def __set__(self, instance: Obj, value):
        if value is not self:
            # Dealing with frozen instances (once we read|write the value should be consider frozen)
            if hasattr(instance, self._prefixed_name):
                setattr(instance, self._prefixed_name, value)
            else:
                object.__setattr__(instance, self._prefixed_name, value)

    def __repr__(self):
        return f'<{type(self).__name__} {self._name}>'


class LazyDefaulDescriptor(Descriptor[Obj, T]):
    """Decriptor which calls default_factory only when the value is not set yet upon first read
    Note: It can be used within frozen dataclassses
    WARNING: Be very carefull while debugging this descriptor.
     Revealing the property in the debugger will cause the descriptor to be called,
     moreover during such call all debugging points will be suppressed.
    """

    _default_factory: Callable[[Obj, str], T]

    def __init__(
        self, default_factory: Callable[[Obj, str], T], property_prefix: str = '_lazy_'
    ):
        super().__init__(property_prefix=property_prefix)
        self._default_factory = default_factory

    def __get__(self, instance: Union[Obj, None], owner: Any) -> T:
        # If we are accessing the descriptor from the dataclass wrapper, return the descriptor
        if instance is None:
            return self  # type: ignore

        # If the value is already set, return it
        set_value = getattr(instance, self._prefixed_name, MISSING)
        if set_value is not MISSING:
            return set_value

        # If the value is not set, create it and set it
        default = self._default_factory(instance, self._name)
        object.__setattr__(instance, self._prefixed_name, default)
        return default


class MappingProxy(Mapping[str, Any]):
    """Proxy which allows to access instance mapping as dictionary
    This is used to render templates based on object attributes or dataclass fields
    """

    _instance: Any

    def __init__(self, instance: Any):
        self._instance = instance

    def __len__(self) -> int:
        raise NotImplementedError

    def __iter__(self):
        raise NotImplementedError

    def __getitem__(self, key: str):
        return getattr(self._instance, key)


class TemplateDescriptor(LazyDefaulDescriptor[Any, str]):
    _nested_call: bool = False

    def __init__(
        self, template: Union[Template, str], property_prefix: str = '_template_'
    ):
        _template = template if isinstance(template, Template) else Template(template)

        def _default_factory(instance: Any, prop: str) -> str:
            # Since was try to access properties of object to render object property
            # we would be facing recursion issues
            if self._nested_call:
                raise RecursionError(
                    f'Unable to render template {_template.template}, '
                    f'this is most likely due to a circular dependency in the template.'
                )

            # Generate default value using template
            with self:
                try:
                    return _template.substitute(MappingProxy(instance))
                except KeyError as e:
                    raise Exception(
                        f'Unable to render template {_template.template}, '
                        f'{instance} is missing required property {e.args[0]}'
                    ) from e

        super().__init__(
            default_factory=_default_factory, property_prefix=property_prefix
        )

    def __enter__(self):
        self._nested_call = True

    def __exit__(self, exc_type, exc_val, exc_tb):
        self._nested_call = False


class CauseDefaultingDescriptor(LazyDefaulDescriptor[Any, T]):
    """Descriptor which returns default value from the exception __cause__ if it exists
    If running on a dataclass, it will try to match the type of the field
    """

    def __init__(
        self,
        default: T = MISSING,  # type: ignore
        prefix: str = '_cause_',
        replace_self: bool = False,
    ):
        def _default_factory(instance: Any, prop: str) -> T:
            cause = getattr(instance, '__cause__', MISSING)
            if cause is not MISSING:
                cause_value = getattr(cause, prop, MISSING)
                if cause_value is not MISSING:
                    try:
                        for f in fields(instance):
                            if f.name == prop:
                                if isinstance(cause_value, f.type):
                                    return cause_value
                                break
                    except TypeError:
                        # Running on a non dataclass
                        return cause_value
            return default

        super().__init__(default_factory=_default_factory, property_prefix=prefix)
