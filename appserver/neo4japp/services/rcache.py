""" Redis Cache """
import os
import redis
import json


REDIS_HOST = os.environ.get('REDIS_HOST')
REDIS_PORT = os.environ.get('REDIS_PORT')
REDIS_PASSWORD = os.environ.get('REDIS_PASSWORD')
REDIS_SSL = os.environ.get('REDIS_SSL', 'false')


DEFAULT_CACHE_SETTINGS = {
    'ex': 3600 * 24
}

redis_server = redis.Redis(
    ssl=REDIS_SSL.lower() == 'true',
    connection_pool=redis.BlockingConnectionPool(
        host=REDIS_HOST,
        port=REDIS_PORT,
        password=REDIS_PASSWORD,
        decode_responses=True,
    )
)

###########################
#
#   REDIS HELPER METHODS
#
###########################


def redis_cached(
        uid: str,
        result_provider,
        cache_setting=DEFAULT_CACHE_SETTINGS,
        load=None,
        dump=None
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
    if cached_result:
        return load(cached_result) if load else cached_result
    else:
        result = result_provider()
        dumped_result = dump(result) if dump else result
        redis_server.set(uid, dumped_result, **cache_setting)
        if load is None:
            return dumped_result
        return result


def set_cache_data(key, value, cache_expiration=1209600):
    """ This is used to distinguish between different environments
    since we connect to a single Redis instance and keys could
    potentially collide.
    """
    redis_server.set(key, json.dumps(value))
    redis_server.expire(key, cache_expiration)
    return redis_server.get(key)


def get_cache_data(key):
    """ This is used to distinguish between different environments
    since we connect to a single Redis instance. By default, our
    setter will add the global Redis prefix.
    """
    return redis_server.get(key)
