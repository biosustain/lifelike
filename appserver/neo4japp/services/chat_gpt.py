import openai
from cachetools import Cache, cached

from neo4japp.services.rcache import RedisCache

class ChatGPT:
    class Completion(openai.Completion):
        cache: Cache = RedisCache('ChatGPT', 'Completion')

        @staticmethod
        @cached(cache=cache)
        def create(*args, **kwargs):
            return openai.Completion.create(*args, **kwargs)

