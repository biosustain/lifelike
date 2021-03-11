import os
from neo4japp.services.common import RedisDao


class RedisHelperService(RedisDao):

    def __init__(self, redis_conn):
        super().__init__(redis_conn=redis_conn)

    # Helper method to use redis cache
    #   If:
    #       load and dump defined - returns result_provider() results as is
    #       only dump defined - returns dump(result_provider())
    #       only load defined - returns load(result_provider()) if cached,
    #                           but result_provider() otherwise!
    #                           use with caution!!!
    def redis_cached(
            self,
            uid: str,
            result_provider,
            cache_setting=None,
            load=None,
            dump=None
    ):
        if cache_setting is None:
            cache_setting = dict(ex=3600 * 24)

        cached_result = self.redis.get(uid)
        if cached_result:
            return load(cached_result) if load else cached_result
        else:
            result = result_provider()
            dumped_result = dump(result) if dump else result
            self.redis.set(uid, dumped_result, **cache_setting)
            if load is None:
                return dumped_result
            return result
