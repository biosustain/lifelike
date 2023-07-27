from cachetools.keys import hashkey
from flask import jsonify, Response, Blueprint
from webargs.flaskparser import use_args

from neo4japp.schemas.playground.chat_completions import ChatCompletionsRequestSchema
from neo4japp.schemas.playground.completions import CompletionsRequestSchema
from neo4japp.services.chat_gpt import ChatGPT
from neo4japp.util import stream_to_json_lines
from neo4japp.utils.globals import config, current_username

bp = Blueprint('playground', __name__, url_prefix='/playground')


def check_if_playground_enabled():
    if not config.get('CHAT_GPT_PLAYGROUND_ENABLED', False):
        raise Exception('Playground is disabled in production')


@bp.route('/models', methods=['GET'])
def models():
    check_if_playground_enabled()
    return jsonify(ChatGPT.Model.list()['data'])


def _completions_call(completion, params):
    wrapped_params = {**params, 'user': str(hash(current_username))}
    if params.get('stream'):
        response = ChatGPT.Completion.create_stream(**wrapped_params)
        return Response(stream_to_json_lines(response), mimetype='text/plain')

    cached = hashkey(**wrapped_params) in completion.cache
    response = completion.create(**wrapped_params)
    return jsonify(dict(result=response, cached=cached))


@bp.route('/completions', methods=['POST'])
@use_args(CompletionsRequestSchema)
def completions(params):
    check_if_playground_enabled()
    return _completions_call(ChatGPT.Completion, params)


@bp.route('/completions/models', methods=['GET'])
def completions_models():
    check_if_playground_enabled()
    return jsonify(ChatGPT.Completion.model_list())


@bp.route('/chat/completions', methods=['POST'])
@use_args(ChatCompletionsRequestSchema)
def chat_completions(params):
    check_if_playground_enabled()
    return _completions_call(ChatGPT.ChatCompletion, params)


@bp.route('/chat/completions/models', methods=['GET'])
def chat_completions_models():
    check_if_playground_enabled()
    return jsonify(ChatGPT.ChatCompletion.model_list())
