from typing import Dict, Callable, Any
from jinja2 import Environment


def format_object_factory(
    _formatters: Dict[type, Callable[[Any], str]], escape: Callable[[str], str]
):
    def format_object(obj: Any) -> str:
        """Format an object.

        Args:
            obj: object to format

        Returns:
            str
        """
        if type(obj) in _formatters:
            return _formatters[type(obj)](obj)
        for _formatter in _formatters:
            if isinstance(obj, _formatter):
                return _formatters[_formatter](obj)
        if hasattr(obj, '_repr_html_'):
            # noinspection PyProtectedMember
            return obj._repr_html_()
        return escape(repr(obj))

    return format_object


def register_filter(
    env: Environment, filter_: Callable[[Any], Any], filter_name: str = None
):
    env.filters[filter_name if filter_name else filter_.__name__] = filter_
