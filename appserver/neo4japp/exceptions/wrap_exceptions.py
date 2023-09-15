import functools
from typing import Tuple, Union, Type, Callable, Protocol
from neo4japp.exceptions import ServerException


class WrappingExceptionFactory(Protocol):
    def __call__(self, exception: Exception, **kwargs) -> Exception:
        ...


def wrap_exceptions(
    wrapping_exception: Union[Type[Exception], WrappingExceptionFactory],
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
                if isinstance(wrapping_exception, type):
                    # noinspection PyArgumentList
                    raise wrapping_exception(**exception_kwargs) from e
                else:
                    raise wrapping_exception(e, **exception_kwargs) from e

        wrapper.__wrapped__ = func
        return wrapper

    return decorator


__all__ = ["wrap_exceptions"]
