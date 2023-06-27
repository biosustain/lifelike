import openai
from cachetools import Cache, cached

from neo4japp.services.rcache import RedisCache


class ChatGPT:
    class Completion(openai.Completion):
        cache: Cache = RedisCache(
            'ChatGPT', 'Completion', ex=3600 * 24 * 7  # Cache for a week
        )
        models = [
            'gpt-3.5-turbo',
            'gpt-3.5-turbo-16k',
            'gpt-3.5-turbo-0613',
            'gpt-3.5-turbo-16k-0613',
            'text-davinci-003',
            'text-davinci-002',
            "text-davinci-003",
        ]

        @staticmethod
        @cached(cache=cache)
        def create(*args, **kwargs):
            return openai.Completion.create(*args, **kwargs)

        def create_stream(*args, **kwargs):
            return openai.Completion.create(*args, **kwargs)

    @staticmethod
    def init_app(app):
        openai.api_key = app.config.get("OPENAI_API_KEY")
