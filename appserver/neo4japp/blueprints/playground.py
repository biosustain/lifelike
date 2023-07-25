from cachetools.keys import hashkey
from flask import jsonify, Response, Blueprint
from webargs.flaskparser import use_args

from neo4japp.schemas.playground import CompletionsRequestSchema, ChatCompletionsRequestSchema
from neo4japp.services.chat_gpt import ChatGPT
from neo4japp.util import stream_to_json_lines
from neo4japp.utils.globals import config, current_username

bp = Blueprint('playground', __name__, url_prefix='/playground')


@bp.route('/models', methods=['GET'])
def models():
    return jsonify(ChatGPT.Model.list()['data'])


@bp.route('/completions', methods=['POST'])
@use_args(CompletionsRequestSchema)
def completions(params):
    if not config.get('CHAT_GPT_PLAYGROUND_ENABLED', False):
        raise Exception('Playground is disabled in production')

    wrapped_params = {**params, 'user': str(hash(current_username))}
    if params.get('stream'):
        response = ChatGPT.Completion.create_stream(**wrapped_params)
        return Response(stream_to_json_lines(response), mimetype='text/plain')

    cached = hashkey(**wrapped_params) in ChatGPT.Completion.cache
    response = ChatGPT.Completion.create(**wrapped_params)
    return jsonify(dict(result=response, cached=cached))


@bp.route('/completions/models', methods=['GET'])
def completions_models():
    return jsonify(ChatGPT.Completion.model_list())


@bp.route('/chat/completions', methods=['POST'])
@use_args(ChatCompletionsRequestSchema)
def completions(params):
    if not config.get('CHAT_GPT_PLAYGROUND_ENABLED', False):
        raise Exception('Playground is disabled in production')

    wrapped_params = {**params, 'user': str(hash(current_username))}
    if params.get('stream'):
        response = ChatGPT.ChatCompletion.create_stream(**wrapped_params)
        return Response(stream_to_json_lines(response), mimetype='text/plain')

    cached = hashkey(**wrapped_params) in ChatGPT.ChatCompletion.cache
    response = ChatGPT.ChatCompletion.create(**wrapped_params)
    return jsonify(dict(result=response, cached=cached))


@bp.route('/completions/models', methods=['GET'])
def completions_models():
    return jsonify(ChatGPT.ChatCompletion.model_list())
