""" Redis Cache """
import os
import redis

REDIS_HOST = os.environ.get('REDIS_HOST')
REDIS_PORT = os.environ.get('REDIS_PORT')
REDIS_PASSWORD = os.environ.get('REDIS_PASSWORD')
REDIS_SSL = os.environ.get('REDIS_SSL', 'false').lower()


DEFAULT_CACHE_SETTINGS = {
    'ex': 3600 * 24
}

connection_prefix = 'rediss' if REDIS_SSL == 'true' else 'redis'
connection_url = f'{connection_prefix}://{REDIS_PASSWORD}@{REDIS_HOST}:{REDIS_PORT}/0'

redis_server = redis.Redis(
    connection_pool=redis.BlockingConnectionPool.from_url(connection_url))


def redis_cached(
        uid: str,
        result_provider,
        cache_setting=DEFAULT_CACHE_SETTINGS,
        load=lambda x: x,
        dump=lambda x: x,
):
    """
    Helper method to use redis cache
    If:
        load and dump defined - returns result_provider() results as is
        only dump defined - returns dump(result_provider())
        only load defined - returns load(result_provider()) if cached,
                            but result_provider() otherwise!
                            use with caution!!!
    """
    cached_result = redis_server.get(uid)
    if cached_result is not None:
        return load(cached_result)
    else:
        result = result_provider()
        dumped_result = dump(result)
        redis_server.set(uid, dumped_result, **cache_setting)
        return dumped_result
