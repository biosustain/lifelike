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
    _in = params.get('_in')
    response = ChatGPT.Completion.create(
        model="text-davinci-003",
        prompt=(
            'What is the relationship between '
            + ', '.join(entities)
            + (f' in {_in}' if _in else '')
            + '?'
            # + '\nPlease provide URL sources for your answer.'
        ),
        temperature=0,
        max_tokens=200,
        user=str(hash(current_username)),
        timeout=60,
    )
    for choice in response.get('choices'):
        return {"result": choice.get('text').strip()}
