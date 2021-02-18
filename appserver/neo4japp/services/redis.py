import os
import redis

redis_server = redis.Redis(
    connection_pool=redis.BlockingConnectionPool(
        host=os.environ.get("REDIS_HOST"),
        port=os.environ.get("REDIS_PORT"),
        decode_responses=True)
)
