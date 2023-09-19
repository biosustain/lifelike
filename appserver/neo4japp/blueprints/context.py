from flask import Blueprint
from webargs.flaskparser import use_args

from neo4japp.schemas.context import ContextRelationshipRequestSchema
from neo4japp.services.chat_gpt import ChatGPT
from neo4japp.utils.globals import current_username
from neo4japp.utils.string import compose_lines, indent_lines

bp = Blueprint('chat-gpt-api', __name__, url_prefix='/explain')


@bp.route('/relationship', methods=['POST'])
@use_args(ContextRelationshipRequestSchema)
def relationship(params):
    entities = params.get('entities', [])
    context = params.get('context')
    options = params.get('options', {})
    escaped_terms = (ChatGPT.escape(term) for term in entities + [context] if term)
    create_params = dict(
        model="gpt-3.5-turbo",
        messages=[
            dict(
                role="user",
                content=(
                    f'Given list of terms delimited by {ChatGPT.DELIMITER},'
                    f' explain what is the relationship between them?\n'
                    f'List of terms: {ChatGPT.DELIMITER}'
                    f'''{
                        compose_lines(
                            *indent_lines(
                                *escaped_terms
                            )
                        )
                    }'''
                    f'{ChatGPT.DELIMITER}'
                ),
            )
        ],
        temperature=options.get('temperature', 0),
        max_tokens=2000,
        user=str(hash(current_username)),
        timeout=60,
    )
    response = ChatGPT.ChatCompletion.create(**create_params)
    for choice in response.get('choices'):
        return {
            "result": choice.get('message').get('content').strip(),
            "query_params": create_params,
        }
