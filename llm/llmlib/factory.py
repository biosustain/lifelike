from flask import Flask, jsonify
import os

from openai import OpenAIError

from .schemas.error import OpenAiErrorResponseSchema
from .services.chat_gpt import ChatGPT
from .config import Base


def handle_openai_error(ex):
    return jsonify(OpenAiErrorResponseSchema().dump(ex)), ex.code


def create_app():
    app_name = os.environ.get('FLASK_APP', __name__)
    app = Flask(app_name)
    app.config.from_object(Base)
    app.register_error_handler(OpenAIError, handle_openai_error)
    ChatGPT.init_app(app)

    return app
