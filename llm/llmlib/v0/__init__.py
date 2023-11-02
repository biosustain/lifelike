from typing import List, TypedDict, Union

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


class PathRow(TypedDict):
    path: List[Union[str, dict]]


def paths_to_graph(paths: List[PathRow]):
    nodes = {}
    edges = []
    for path_row in paths:
        path = path_row["path"]
        for index, segment in enumerate(path):
            if isinstance(segment, dict):
                nodes[segment["eid"]] = segment
            else:
                edges.append({
                    'from': path[index-1]["eid"],
                    'to': path[index+1]["eid"],
                    'label': segment,
                })

    return dict(
        nodes=list(nodes.values()),
        edges=edges,
    )


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
        llm=llm,
        chain_type_kwargs=dict(prompt=qa_prompt_template),
        retriever=retriever,
        verbose=True,
        callbacks=[handler],
    )

    return dict(
        result=qa(query),
        graph=paths_to_graph(retriever.relationships),
    )
