from typing import List, Optional

from flask import Blueprint
from webargs.flaskparser import use_args

from neo4japp.schemas.context import ContextRelationshipRequestSchema
from neo4japp.services.chat_gpt import ChatGPT
from neo4japp.services.llm import LLM
from neo4japp.utils.globals import current_username

bp = Blueprint('chat-gpt-api', __name__, url_prefix='/explain')


def compose_query(entities: List[str], context: Optional[str]):
    entities_len = len(entities)
    if entities_len < 1:
        raise ValueError('At least one entity must be provided.')

    if entities_len == 1:
        query_core = f'What is {entities[0]}'
    else:
        query_core = f'What is the relationship between {", ".join(entities)}'

    context_query = f' in the context of {context}' if context else''

    return query_core + context_query + '?'


@bp.route('/relationship', methods=['POST'])
@use_args(ContextRelationshipRequestSchema)
def relationship(params):
    entities = params.get('entities', [])
    context = params.get('context')
    options = params.get('options', {})
    create_params = dict(
        model="gpt-3.5-turbo",
        messages=[
            dict(
                role="user",
                content=compose_query(entities, context),
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


@bp.route('/relationship/graph', methods=['POST'])
@use_args(ContextRelationshipRequestSchema)
def relationship_graph(params):
    entities = params.get('entities', [])
    context = params.get('context')
    options = params.get('options', {})
    create_params = dict(
        model="gpt-3.5-turbo",
        query=(
            'What is the relationship between '
            + ', '.join(entities)
            + (f', {context}' if context else '')
            + '?'
        ),
        temperature=options.get('temperature', 0),
        max_tokens=2000,
        user=str(hash(current_username)),
        timeout=60,
    )
    return LLM.graph_qa(**create_params)
