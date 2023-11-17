import string

from IPython import display
from jinja2 import Environment, PackageLoader
from langchain import PromptTemplate, LLMChain
from langchain.chains import SimpleSequentialChain, SequentialChain

from langchain.chat_models import ChatOpenAI
from langchain.embeddings import OpenAIEmbeddings
from langchain.graphs import Neo4jGraph
from langchain.prompts import ChatPromptTemplate
from langchain.prompts.chat import BaseStringMessagePromptTemplate
from llmlib.utils.search.cypher_search_api_wrapper import CypherSearchAPIWrapper
from openai.openai_object import OpenAIObject

from llmlib.utils.chains.graph_query import GraphQueryChain

from llmlib.utils.chains.graph_cypher_qa_chain import GraphCypherQAChain
from pydantic.v1 import BaseModel

from .utils import format_object_factory, register_filter

_html_env = Environment(
    loader=PackageLoader('develop.utils.formatters', 'html_templates'),
    lstrip_blocks=True,
    trim_blocks=True,
)

# noinspection PyProtectedMember
register_filter(
    _html_env,
    lambda *args, **kwargs: display.Code(*args, **kwargs)._repr_html_(),
    'code',
)
register_filter(
    _html_env,
    lambda t, *args, **kwargs: string.Template(t).safe_substitute(*args, **kwargs),
    'template',
)


def pydantic_model_formatter(model: BaseModel) -> str:
    kwargs_exclude_defaults = model.dict(exclude_defaults=True)
    return _html_env.get_template('pydantic_model.html.jinja2').render(
        model=model,
        not_default_keys=tuple(kwargs_exclude_defaults.keys()),
    )


html_formatters = {
    ChatPromptTemplate: lambda pt: _html_env.get_template(
        'chat_prompt_template.html.jinja2'
    ).render(pt=pt),
    BaseStringMessagePromptTemplate: lambda pt: _html_env.get_template(
        'base_string_message_prompt_template.html.jinja2'
    ).render(pt=pt),
    PromptTemplate: lambda pt: _html_env.get_template(
        'prompt_template.html.jinja2'
    ).render(pt=pt),
    LLMChain: lambda chain: _html_env.get_template('llm_chain.html.jinja2').render(
        chain=chain
    ),
    SimpleSequentialChain: lambda chain: _html_env.get_template(
        'sequential_chain.html.jinja2'
    ).render(chain=chain),
    SequentialChain: lambda chain: _html_env.get_template(
        'sequential_chain.html.jinja2'
    ).render(chain=chain),
    list: lambda l: _html_env.get_template('list.html.jinja2').render(l=l),
    dict: lambda obj: _html_env.get_template('dict.html.jinja2').render(obj=obj),
    str: lambda s: _html_env.get_template('str.html.jinja2').render(s=s),
    GraphQueryChain: lambda chain: _html_env.get_template(
        'graph_query_chain.html.jinja2'
    ).render(chain=chain),
    GraphCypherQAChain: lambda chain: _html_env.get_template(
        'graph_cypher_qa_chain.html.jinja2'
    ).render(chain=chain),
    Neo4jGraph: lambda graph: _html_env.get_template('neo4j_graph.html.jinja2').render(
        graph=graph
    ),
    OpenAIObject: lambda obj: _html_env.get_template(
        'openai_object.html.jinja2'
    ).render(obj=obj),
    ChatOpenAI: lambda obj: _html_env.get_template('openai_chat.html.jinja2').render(
        obj=obj
    ),
    OpenAIEmbeddings: lambda obj: _html_env.get_template(
        'openai_embeddings.html.jinja2'
    ).render(obj=obj),
    BaseModel: pydantic_model_formatter,
    CypherSearchAPIWrapper: lambda obj: _html_env.get_template(
        'cypher_search_api_wrapper.html.jinja2'
    ).render(obj=obj),
}

register_filter(
    _html_env, format_object_factory(html_formatters, _html_env.filters['escape'])
)
