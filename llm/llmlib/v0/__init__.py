import logging

from langchain import PromptTemplate
from langchain.callbacks import StdOutCallbackHandler
from langchain.chains import RetrievalQA
from langchain.chat_models import ChatOpenAI
from langchain.embeddings import OpenAIEmbeddings
from langchain.prompts import (
    ChatPromptTemplate,
    SystemMessagePromptTemplate,
    HumanMessagePromptTemplate,
)
from langchain.vectorstores import Chroma
from llmlib.utils.retrievers.graph_search_retriever import GraphSearchRetriever
from llmlib.utils.search.cypher_search_api_wrapper import CypherSearchAPIWrapper


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
handler = StdOutCallbackHandler()


def graph_qa_v0(query: str, graph, **kwargs):
    """Query the LLM for a given text."""
    llm = ChatOpenAI(**{**dict(temperature=0, verbose=True), **kwargs})  # defaults
    search = CypherSearchAPIWrapper(
        graph=graph, verbose=True, return_intermediate_steps=True
    )
    # noinspection PyTypeChecker
    retriever = GraphSearchRetriever.from_llm(
        vectorstore=vectorstore,
        llm=llm,
        graph_search=search,
        prompt=core_terms_prompt_template,
        verbose=True,
        return_intermediate_steps=True,
        callbacks=[handler],
    )
    qa = RetrievalQA.from_chain_type(
        llm=llm, retriever=retriever, verbose=True, callbacks=[handler]
    )
    return qa(query)
