from flask import Blueprint
from webargs.flaskparser import use_args

from neo4japp.schemas.context import ContextRelationshipRequestSchema
from neo4japp.services.chat_gpt import ChatGPT
from neo4japp.utils.globals import current_username

bp = Blueprint('chat-gpt-api', __name__, url_prefix='/explain')


@bp.route('/relationship', methods=['POST'])
@use_args(ContextRelationshipRequestSchema)
def relationship(params):
    entities = params.get('entities', [])
    context = params.get('context_')
    options = params.get('options', {})
    response = ChatGPT.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[
            dict(
                role="user",
                content=(
                        'What is the relationship between '
                        + ', '.join(entities)
                        + (f', {context}' if context else '')
                        + '?'
                        # + '\nPlease provide URL sources for your answer.'
                ),
            )
        ],
        temperature=options.get('temperature', 0),
        max_tokens=200,
        user=str(hash(current_username)),
        timeout=60,
    )
    for choice in response.get('choices'):
        return {"result": choice.get('message').get('content').strip()}
