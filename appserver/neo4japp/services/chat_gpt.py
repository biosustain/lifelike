import openai
from cachetools import Cache, cached

from neo4japp.services.rcache import RedisCache


class ChatGPT:
    class Completion(openai.Completion):
        cache: Cache = RedisCache(
            'ChatGPT', 'Completion', ex=3600 * 24 * 7  # Cache for a week
        )
        # Information which seems to be only avaliable in here:
        # https://platform.openai.com/docs/models/model-endpoint-compatibility
        _compatible_models = [
            "text-davinci-003",
            "text-davinci-002",
            "text-davinci-001",
            "text-curie-001",
            "text-babbage-001",
            "text-ada-001",
            "davinci",
            "curie",
            "babbage",
            "ada"
        ]

        @staticmethod
        @cached(cache=cache)
        def model_list(*args, **kwargs):
            return [
                model
                for model in ChatGPT.Model.list(*args, **kwargs)
                if model.get('id') in ChatGPT.Completion._compatible_models
            ]

        @staticmethod
        @cached(cache=cache)
        def create(*args, **kwargs):
            return openai.Completion.create(*args, **kwargs)

        def create_stream(*args, **kwargs):
            return openai.Completion.create(*args, **kwargs)

    class ChatCompletion(openai.ChatCompletion):
        cache: Cache = RedisCache(
            'ChatGPT', 'ChatCompletion', ex=3600 * 24 * 7  # Cache for a week
        )
        # Information which seems to be only avaliable in here:
        # https://platform.openai.com/docs/models/model-endpoint-compatibility
        _compatible_models = [
            "gpt-4",
            "gpt-4-0613",
            "gpt-4-32k",
            "gpt-4-32k-0613",
            "gpt-3.5-turbo",
            "gpt-3.5-turbo-0613",
            "gpt-3.5-turbo-16k",
            "gpt-3.5-turbo-16k-0613"
        ]

        @staticmethod
        @cached(cache=cache)
        def model_list(*args, **kwargs):
            return [
                model
                for model in ChatGPT.Model.list(*args, **kwargs)
                if model.get('id') in ChatGPT.ChatCompletion._compatible_models
            ]

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
            return openai.Model.list(*args, **kwargs)['data']

    @staticmethod
    def init_app(app):
        openai.api_key = app.config.get("OPENAI_API_KEY")
