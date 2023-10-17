from typing import Union

from flask import g
from langchain import OpenAI
from langchain.chat_models import ChatOpenAI
from langchain.graphs import Neo4jGraph, ArangoGraph
from llmlib.schemas import GraphQARequestSchema
from webargs.flaskparser import use_args
from .app import app
from .database import Arango, Neo4j
from .interfaces import GraphRef
from .schemas import GraphCompletionsRequestSchema, GraphChatCompletionsRequestSchema


@app.route('/', methods=['GET', 'POST'])
def enrich():
    raise Exception('No function provided!')


@app.route('/healthz', methods=['GET', 'POST'])
def healthz():
    return "I am OK!"


def map_graph_ref(graph: GraphRef) -> Union[ArangoGraph, Neo4jGraph]:
    database_type = graph['database_type']
    if database_type == 'arango':
        database = Arango
    elif database_type == 'neo4j':
        database = Neo4j
    else:
        raise Exception('Invalid database type!')
    database_name = graph.get('database_name')
    return database().graph(database_name) if database_name else database().graph()


def map_request_arguments(args):
    model_kwargs = dict()
    if 'graph' in args:
        model_kwargs['graph'] = map_graph_ref(args['graph'])
    if 'temperature' in args:
        model_kwargs['temperature'] = args['temperature']
    if 'top_p' in args:
        model_kwargs['top_p'] = args['top_p']
    if 'frequency_penalty' in args:
        model_kwargs['frequency_penalty'] = args['frequency_penalty']
    if 'presence_penalty' in args:
        model_kwargs['presence_penalty'] = args['presence_penalty']
    if 'stop' in args:
        model_kwargs['stop'] = args['stop']
    if 'n' in args:
        model_kwargs['n'] = args['n']
    if 'logit_bias' in args:
        model_kwargs['logit_bias'] = args['logit_bias']
    if 'logprobs' in args:
        model_kwargs['logprobs'] = args['logprobs']
    if 'stream' in args:
        model_kwargs['stream'] = args['stream']
    if 'max_tokens' in args:
        model_kwargs['max_tokens'] = args['max_tokens']
    if 'timeout' in args:
        model_kwargs['timeout'] = args['timeout']
    if 'user' in args:
        model_kwargs['user'] = args['user']
    return model_kwargs


@app.route('/completions', methods=['POST'])
@use_args(GraphCompletionsRequestSchema)
def completions(args):
    getattr(g, 'transaction_id', args['transaction_id'])
    return OpenAI(**map_request_arguments(args))


@app.route('/chat', methods=['POST'])
@use_args(GraphChatCompletionsRequestSchema)
def chat(args):
    getattr(g, 'transaction_id', args['transaction_id'])
    return ChatOpenAI(**map_request_arguments(args))


@app.route('/graph', methods=['POST'])
@use_args(GraphQARequestSchema)
def graph(args):
    getattr(g, 'transaction_id', args['transaction_id'])
    from llmlib.v0 import graph_qa_v0

    return graph_qa_v0(args['query'], **map_request_arguments(args))
