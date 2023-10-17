from langchain.callbacks import StdOutCallbackHandler
from langchain.chains import RetrievalQA
from langchain.chat_models import ChatOpenAI
from langchain.embeddings import OpenAIEmbeddings
from langchain.prompts import PromptTemplate
from langchain.prompts.chat import (
    ChatPromptTemplate,
    SystemMessagePromptTemplate,
    HumanMessagePromptTemplate,
)
from langchain.vectorstores import Chroma
from llmlib.database import Neo4j
from llmlib.utils.retrievers.graph_search_retriever import GraphSearchRetriever
from llmlib.utils.search.cypher_search_api_wrapper import CypherSearchAPIWrapper

from app import app

QUERIES = (
    "What is the relationship between Zn2+ and glycolate?",
    "What is the relationship between INHBA and MTMR4?",
)


def test_queries():
    with app.app_context():
        llm = ChatOpenAI(temperature=0, verbose=True)
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
        vectorstore = Chroma(
            embedding_function=embeddings, persist_directory="./chroma_db_oai"
        )
        graph = Neo4j().graph()
        search = CypherSearchAPIWrapper(
            graph=graph, verbose=True, return_intermediate_steps=True
        )
        handler = StdOutCallbackHandler()
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

        for query in QUERIES:
            print(qa.run(query))
