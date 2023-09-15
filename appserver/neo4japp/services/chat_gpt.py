from random import random

import openai
from cachetools import Cache, cached
from math import floor
from openai import OpenAIError

from neo4japp.models.chatgpt_usage import (
    save_stream_response_to_usage_tracking_table,
    save_response_to_usage_tracking_table,
)
from neo4japp.exceptions import wrap_exceptions
from neo4japp.exceptions.exceptions import OpenAiServerException, ServerException
from neo4japp.services.rcache import RedisCache


def map_openai_exception(e: OpenAIError):
    exception_type = type(e)
    if exception_type == openai.error.AuthenticationError:
        return ServerException(
            message="OpenAI API Key is invalid. Please contact the administrator."
        )
    return OpenAiServerException()


"""Function call wrapper which maps OpenAI exceptions to our own exception format"""
# noinspection PyTypeChecker
openai_exception_wrapper = wrap_exceptions(map_openai_exception, OpenAIError)  # type: ignore

EXCEPTION_TEST_CASES = [
    openai.error.InvalidRequestError(
        "Could not determine which URL to request: %s instance "
        "has invalid ID: %r, %s. ID should be of type `str` (or"
        " `unicode`)",
        "id",
    ),
    openai.error.InvalidAPIType("Unsupported API type %s"),
    openai.error.InvalidRequestError(
        "Must provide an 'engine' or 'model' parameter to create a %s",
        "engine",
    ),
    openai.error.APIError(
        "Deployment operations are only available for the Azure API type."
    ),
    openai.error.InvalidAPIType(
        "This operation is not supported by the Azure OpenAI API yet."
    ),
    openai.error.AuthenticationError(),
]


class ChatGPT:
    """Wrapper for OpenAI's Chat API"""

    DELIMITER = "```"  # Used to escape user defined input

    @staticmethod
    def escape(text: str):
        return text.replace(ChatGPT.DELIMITER, f'[ignored]')

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
            "ada",
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
        @save_response_to_usage_tracking_table
        @openai_exception_wrapper
        def create(*args, **kwargs):
            return openai.Completion.create(*args, **kwargs)

        @staticmethod
        @save_stream_response_to_usage_tracking_table
        @openai_exception_wrapper
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
            "gpt-3.5-turbo-16k-0613",
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
        @save_response_to_usage_tracking_table
        @openai_exception_wrapper
        def create(*args, **kwargs):
            return openai.ChatCompletion.create(*args, **kwargs)

        @staticmethod
        @save_stream_response_to_usage_tracking_table
        @openai_exception_wrapper
        def create_stream(*args, **kwargs):
            return openai.ChatCompletion.create(*args, **kwargs)

    class Model(openai.Model):
        cache: Cache = RedisCache('ChatGPT', 'Model', ex=3600 * 24)  # Cache for a day

        @staticmethod
        @cached(cache=cache)
        @openai_exception_wrapper
        def list(*args, **kwargs):
            return openai.Model.list(*args, **kwargs)['data']

    @staticmethod
    def init_app(app):
        openai.api_key = app.config.get("OPENAI_API_KEY")


__all__ = ["ChatGPT"]
