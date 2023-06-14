""" Redis Cache """
import json
from typing import TypeVar, Generic, Callable, Tuple

import redis
from cachetools import Cache

from neo4japp.utils.globals import config

DEFAULT_CACHE_SETTINGS = {'ex': 3600 * 24}

_redis_server: redis.Redis


def get_redis_server():
    global _redis_server
    if _redis_server is None:
        REDIS_HOST = config.get('REDIS_HOST')
        REDIS_PORT = config.get('REDIS_PORT')
        REDIS_PASSWORD = config.get('REDIS_PASSWORD')
        REDIS_SSL = config.get('REDIS_SSL', 'false').lower()

        connection_prefix = 'rediss' if REDIS_SSL == 'true' else 'redis'
        connection_url = (
            f'{connection_prefix}://:{REDIS_PASSWORD}@{REDIS_HOST}:{REDIS_PORT}/0'
        )

        _redis_server = redis.Redis(
            connection_pool=redis.BlockingConnectionPool.from_url(connection_url)
        )
    return _redis_server


Key = TypeVar('Key')
Value = TypeVar('Value')


class RedisCache(Generic[Key, Value], Cache):
    _prefixes: Tuple[str, ...]
    _prefix_separator: str = ':'
    _dumps: Callable[[Value], str]
    _loads: Callable[[str], Value]
    _cache_setting = DEFAULT_CACHE_SETTINGS
    _redis: redis.Redis

    def __init__(
        self,
        *prefixes: str,
        dumps: Callable[[Value], str] = json.dumps,
        loads: Callable[[str], Value] = json.loads,
        maxsize=float('inf'),
        getsizeof=None,
        **cache_setting,
    ):
        super().__init__(maxsize, getsizeof)
        self._prefixes = prefixes
        self._dumps = dumps
        self._loads = loads
        self._cache_setting = {**DEFAULT_CACHE_SETTINGS, **cache_setting}
        self._redis = get_redis_server()

    def compose_key(self, key: Key) -> str:
        print(key)
        return self._prefix_separator.join(
            part for part in (*self._prefixes, str(key)) if part
        )

    def __getitem__(self, key: Key):
        item = self._redis.get(self.compose_key(key))
        if item is None:
            return self.__missing__(key)
        return self._loads(item)

    def __setitem__(self, key, value):
        self._redis.set(
            self.compose_key(key), self._dumps(value), **self._cache_setting
        )

    def __delitem__(self, key):
        self._redis.delete(self.compose_key(key))

    def __contains__(self, key):
        return self._redis.exists(key)

    def __iter__(self):
        return self._redis.scan_iter()

    def __len__(self):
        return self._redis.dbsize()

    @property
    def currsize(self):
        return len(self)
