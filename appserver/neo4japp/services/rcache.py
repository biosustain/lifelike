"""Redis Cache"""
import os
import redis

from neo4japp.database import CACHE_REDIS_URL

DEFAULT_CACHE_SETTINGS = dict(ex=3600 * 24)

cache = None
def _get_redis_instance():
    """Memoized redis instance"""
    if not cache:
        connection_pool = redis.BlockingConnectionPool.from_url(CACHE_REDIS_URL)
        cache = redis.Redis(connection_pool=connection_pool)
    return cache

# Helper method to use redis cache
#   If:
#       load and dump defined - returns result_provider() results as is
#       only dump defined - returns dump(result_provider())
#       only load defined - returns load(result_provider()) if cached,
#                           but result_provider() otherwise!
#                           use with caution!!!
#
#
# TODO: switch to the three functions below
def redis_cached(
        uid: str,
        # TODO: why is this a function? Better if it's a data type...
        # Needs refactor to be generic for other uses
        result_provider,
        cache_setting=DEFAULT_CACHE_SETTINGS,
        load=None,
        dump=None
):
    cache = _get_redis_instance()
    cached_result = cache.get(uid)
    if cached_result:
        return load(cached_result) if load else cached_result
    else:
        result = result_provider()
        dumped_result = dump(result) if dump else result
        cache.set(uid, dumped_result, **cache_setting)
        if load is None:
            return dumped_result
        return result


def getcache(uid: str):
    return _get_redis_instance().get(uid)


def delcache(uid: str):
    if getcache(id):
        _get_redis_instance().delete(uid)


def setcache(
    uid: str,
    data,
    load=None,
    dump=None,
    cache_setting=DEFAULT_CACHE_SETTINGS,
):
    dumped_data = dump(data) if dump else data
    _get_redis_instance().set(uid, dumped_data, **cache_setting)
    return load(dumped_data) if load else dumped_data
