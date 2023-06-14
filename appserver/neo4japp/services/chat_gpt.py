import openai
from cachetools import Cache, cached

from neo4japp.services.rcache import RedisCache


class ChatGPT:
    class Completion(openai.Completion):
        cache: Cache = RedisCache(
            'ChatGPT', 'Completion', ex=3600 * 24 * 7  # Cache for a week
        )

        @staticmethod
        @cached(cache=cache)
        def create(*args, **kwargs):
            return openai.Completion.create(*args, **kwargs)

    @staticmethod
    def init_app(app):
        openai.api_key = app.config.get("OPENAI_API_KEY")
