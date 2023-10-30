from langchain import PromptTemplate
from langchain.callbacks import StdOutCallbackHandler
from langchain.callbacks.manager import CallbackManager
from langchain.chains import RetrievalQA
from langchain.chat_models import ChatOpenAI
from langchain.embeddings import OpenAIEmbeddings
from langchain.prompts import (
    ChatPromptTemplate,
    SystemMessagePromptTemplate,
    HumanMessagePromptTemplate,
)
from langchain.vectorstores import Chroma
from llmlib.utils.callbacks.base import GraphCallbackManager
from llmlib.utils.retrievers.graph_search_retriever import GraphSearchRetriever
from llmlib.utils.search.cypher_search_api_wrapper import CypherSearchAPIWrapper

from .intermediate_result_callback import IntermediateResultCallback

core_terms_prompt_template = ChatPromptTemplate.from_messages(
    [
        SystemMessagePromptTemplate(
            prompt=PromptTemplate(
                template="Always response with comma separated list of chemical or biological terms identified in prompt.",
                input_variables=[],
            )
        ),
        HumanMessagePromptTemplate(
            prompt=PromptTemplate(
                template="{query}",
                input_variables=["query"],
            )
        ),
    ]
)
embeddings = OpenAIEmbeddings()
vectorstore = Chroma(embedding_function=embeddings, persist_directory="./chroma_db_oai")
qa_system_template = """Use the following pieces of context to answer the users question. Each piece of information repsesents uncorelated cases, responses based on different pieces shoul be places into separate paragraphs.
If you don't know the answer, just say that you don't know, don't try to make up an answer.
Work on the answear in two steps:
1. Rephase pieces of context ussing natural language
2. Based on repharsed text respond to the question
----------------
{context}
----------------"""
qa_prompt_template = ChatPromptTemplate.from_messages(
    [
        SystemMessagePromptTemplate.from_template(qa_system_template),
        HumanMessagePromptTemplate.from_template("{question}"),
    ]
)


def graph_qa_v0(query: str, graph, **kwargs):
    """Query the LLM for a given text."""
    llm = ChatOpenAI(**{**dict(temperature=0, verbose=True), **kwargs})  # defaults
    search = CypherSearchAPIWrapper(
        graph=graph, verbose=True, return_intermediate_steps=True
    )
    handler = IntermediateResultCallback()
    callbacks = GraphCallbackManager.from_callback_manager(CallbackManager)(handlers=[handler])
    print(callbacks)
    # noinspection PyTypeChecker
    retriever = GraphSearchRetriever.from_llm(
        vectorstore=vectorstore,
        llm=llm,
        graph_search=search,
        prompt=core_terms_prompt_template,
        verbose=True,
        return_intermediate_steps=True,
        callbacks=callbacks
    )
    qa = RetrievalQA.from_chain_type(
        llm=llm,
        chain_type_kwargs=dict(prompt=qa_prompt_template),
        retriever=retriever,
        verbose=True,
        callbacks=callbacks
    )
    return dict(
        response=qa(query),
        relationships=handler.relationships,
    )
