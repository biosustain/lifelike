""" Redis Cache """
import redis

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
    cache_setting=None,
    load=None,
    dump=None,
):
    if cache_setting is None:
        cache_setting = DEFAULT_CACHE_SETTINGS
    cached_result = get_redis_server().get(uid)
    if cached_result:
        return load(cached_result) if load else cached_result
    else:
        result = result_provider()
        dumped_result = dump(result) if dump else result
        get_redis_server().set(uid, dumped_result, **cache_setting)
        if load is None:
            return dumped_result
        return result


def getcache(uid: str):
    return get_redis_server().get(uid)


def delcache(uid: str):
    redis = get_redis_server()
    if redis.get(uid):
        redis.delete(uid)


def setcache(
    uid: str,
    data,
    load=None,
    dump=None,
    cache_setting=None,
):
    if cache_setting is None:
        cache_setting = DEFAULT_CACHE_SETTINGS
    dumped_data = dump(data) if dump else data
    get_redis_server().set(uid, dumped_data, **cache_setting)
    return load(dumped_data) if load else dumped_data
