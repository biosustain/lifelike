from enum import Enum


class Enumd(Enum):
    @classmethod
    def get(cls, key, default=None):
        # Non-throwing value accessor modeled to behave like dict.get()
        try:
            return cls(key)
        except ValueError:
            return default


__all__ = ['Enumd']
