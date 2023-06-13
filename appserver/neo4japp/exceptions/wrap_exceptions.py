import functools
from typing import Tuple, Union, Type
from neo4japp.exceptions import ServerException


def wrap_exceptions(
    wrapping_exception,
    wrapped_exceptions: Union[
        Type[Exception], Tuple[Type[Exception], ...]
    ] = ServerException,
    **exception_kwargs
):
    """Decorator that reraises wrapping exception in case given exception occurs"""

    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except wrapped_exceptions as e:
                raise wrapping_exception(**exception_kwargs) from e

        wrapper.__wrapped__ = func
        return wrapper

    return decorator


__all__ = ["wrap_exceptions"]
