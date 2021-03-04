import os

import redis

DEFAULT_CACHE_SETTINGS = {
    'ex': 3600 * 24
}

redis_server = redis.Redis(
        connection_pool=redis.BlockingConnectionPool(
                host=os.environ.get("REDIS_HOST"),
                port=os.environ.get("REDIS_PORT"),
                decode_responses=True)
)


def redis_cached(
        uid: str,
        provider,
        cache_setting=DEFAULT_CACHE_SETTINGS,
        load=lambda a: a,
        dump=lambda a: a
):
    cached_result = redis_server.get(uid)
    if cached_result:
        return load(cached_result)
    else:
        result = provider()
        redis_server.set(uid, dump(result), **cache_setting)
        return result
