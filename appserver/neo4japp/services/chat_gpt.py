import openai
from cachetools import Cache, cachedmethod, cached

from neo4japp.services.rcache import RedisCache

openai.api_key = "***OPENAI_API_KEY***"

class ChatGPT:
    class Completion(openai.Completion):
        cache: Cache = RedisCache('ChatGPT', 'Completion')

        @staticmethod
        @cached(cache=cache)
        def create(*args, **kwargs):
            return openai.Completion.create(*args, **kwargs)

