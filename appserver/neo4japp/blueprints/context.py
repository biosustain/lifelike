from cachetools.keys import hashkey
from flask import Blueprint, Response, jsonify
from webargs.flaskparser import use_args

from neo4japp.schemas.context import ContextRelationshipRequestSchema
from neo4japp.schemas.playground import ContextPlaygroundRequestSchema
from neo4japp.services.chat_gpt import ChatGPT
from neo4japp.utils.globals import current_username

bp = Blueprint('chat-gpt-api', __name__, url_prefix='/explain')


@bp.route('/relationship', methods=['POST'])
@use_args(ContextRelationshipRequestSchema)
def relationship(params):
    entities = params.get('entities', [])
    context = params.get('context_')
    options = params.get('options', {})
    response = ChatGPT.Completion.create(
        model="text-davinci-003",
        prompt=(
            'What is the relationship between '
            + ', '.join(entities)
            + (f', {context}' if context else '')
            + '?'
            # + '\nPlease provide URL sources for your answer.'
        ),
        temperature=options.get('temperature', 0),
        max_tokens=200,
        user=str(hash(current_username)),
        timeout=60,
    )
    for choice in response.get('choices'):
        return {"result": choice.get('text').strip()}


@bp.route('/playground', methods=['POST'])
@use_args(ContextPlaygroundRequestSchema)
def playground(params):
    wrapped_params = {**params, 'user': str(hash(current_username))}
    if params.get('stream'):
        response = ChatGPT.Completion.create_stream(**wrapped_params)
        return Response(response, mimetype='text/plain')

    cached = hashkey(**wrapped_params) in ChatGPT.Completion.cache
    response = ChatGPT.Completion.create(**wrapped_params)
    return jsonify(dict(result=response, cached=cached))
