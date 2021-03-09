import os

import redis

DEFAULT_CACHE_SETTINGS = {
    'ex': 3600 * 24
}

redis_server = redis.Redis(
        connection_pool=redis.BlockingConnectionPool(
                host=os.environ.get("REDIS_HOST"),
                port=os.environ.get("REDIS_PORT"),
                decode_responses=True
        )
)


# Helper method to use redis cache
#   If:
#       load and dump defined - returns result_provider() results as is
#       only dump defined - returns dump(result_provider())
#       only load defined - returns load(result_provider()) if cached,
#                           but result_provider() otherwise!
#                           use with caution!!!
def redis_cached(
        uid: str,
        result_provider,
        cache_setting=DEFAULT_CACHE_SETTINGS,
        load=None,
        dump=None
):
    cached_result = redis_server.get(uid)
    if cached_result:
        return load(cached_result) if load else cached_result
    else:
        result = result_provider()
        dumped_result = dump(result) if dump else result
        redis_server.set(uid, dumped_result, **cache_setting)
        if load is None:
            return dumped_result
        return result
