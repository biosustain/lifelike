from abc import ABCMeta


class Singleton(ABCMeta):
    """Singleton metaclass.
    """

    _instances = {}

    def __call__(cls, *args, **kwargs):
        """Return singleton instance."""
        if cls not in cls._instances:
            cls._instances[cls] = super().__call__(*args, **kwargs)
        return cls._instances[cls]
