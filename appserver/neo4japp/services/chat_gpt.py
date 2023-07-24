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

        def create_stream(*args, **kwargs):
            return openai.Completion.create(*args, **kwargs)

    class Model(openai.Model):
        cache: Cache = RedisCache('ChatGPT', 'Model', ex=3600 * 24)  # Cache for a day

        @staticmethod
        @cached(cache=cache)
        def list(*args, **kwargs):
            return openai.Model.list(*args, **kwargs)

    @staticmethod
    def init_app(app):
        openai.api_key = app.config.get("OPENAI_API_KEY")
