import logging
from functools import partial
from typing import Optional, Self, List, Any

from langchain import LLMChain, PromptTemplate, BasePromptTemplate
from langchain.callbacks.manager import CallbackManagerForRetrieverRun
from langchain.chat_models.base import BaseChatModel
from langchain.output_parsers import CommaSeparatedListOutputParser
from langchain.prompts import (
    ChatPromptTemplate,
    SystemMessagePromptTemplate,
    HumanMessagePromptTemplate,
)
from langchain.pydantic_v1 import Field
from langchain.schema import BaseRetriever, Document
from langchain.vectorstores import VectorStore
from llmlib.utils.search.graph_search_api_wrapper import GraphSearchAPIWrapper


def default_terms_prompt_factory(query_key: str):
    return ChatPromptTemplate.from_messages(
        [
            SystemMessagePromptTemplate(
                prompt=PromptTemplate(
                    template="Always response with comma separated list of terms identified in prompt.",
                    input_variables=[],
                )
            ),
            HumanMessagePromptTemplate(
                prompt=PromptTemplate(
                    template=f"{{{query_key}}}",
                    input_variables=[query_key],
                )
            ),
        ]
    )


class GraphSearchRetriever(BaseRetriever):
    vectorstore: VectorStore = Field(
        ..., description="Vectorstore to use for graph results."
    )
    llm_chain: LLMChain
    graph_search: GraphSearchAPIWrapper = Field(
        ..., description="Graph search API wrapper."
    )
    verbose: bool = False

    @classmethod
    def from_llm(
        cls,
        vectorstore: VectorStore,
        llm: BaseChatModel,
        graph_search: GraphSearchAPIWrapper,
        prompt: Optional[BasePromptTemplate] = None,
        **kwargs: Any,
    ) -> Self:
        """Initialize from LLM using the default template."""
        if not prompt:
            prompt = default_terms_prompt_factory(cls.query_key)

        llm_chain = LLMChain(
            llm=llm,
            prompt=prompt,
            output_parser=CommaSeparatedListOutputParser(),
        )

        return cls(
            vectorstore=vectorstore,
            llm_chain=llm_chain,
            graph_search=graph_search,
            **kwargs,
        )

    def _add_nodes_to_vectorstore(self, nodes: List[Document]):
        """Add nodes to vectorstore."""
        return self.vectorstore.add_documents(
            [self.graph_search.node_to_document(node) for node in nodes]
        )

    def _add_relationships_to_vectorstore(self, relationships: List[Document]):
        """Add relationships to vectorstore."""
        return self.vectorstore.add_documents(
            [
                self.graph_search.relationship_to_document(relationship)
                for relationship in relationships
            ]
        )

    def _get_relevant_documents(
        self, query: str, *, run_manager: CallbackManagerForRetrieverRun
    ) -> List[Document]:
        """Get relevant documents from the graph."""

        def sub_text(text, verbose=self.verbose, end='\n', **kwargs):
            return run_manager.on_text(
                '\t' + text.replace('\n', '\n\t'), verbose=verbose, end=end, **kwargs
            )

        def sub_header(text, verbose=self.verbose, end='\n', **kwargs):
            return run_manager.on_text(
                '\n\t\033[1m>> ' + text.replace('\n', '\n\t') + '\033[0m',
                verbose=verbose,
                end=end,
                **kwargs,
            )

        # Get search terms
        sub_header("Generating list of revelant terms")
        inputs = self.llm_chain.prep_inputs({"query": query})
        output = self.llm_chain(inputs)
        terms = output['text']
        sub_text(f"Identified Terms:\n{terms}")

        sub_header("Searching for related graph nodes")
        nodes = self.graph_search.get_related_nodes(terms)
        sub_text(f"Identified Nodes:\n{nodes}")

        if len(nodes) > 1:
            sub_header("Searching for related graph relationships\n")
            relationships = self.graph_search.get_relationships(nodes)
            sub_text(f"Identified Relationships:\n{relationships}\n")
            # self._add_relationships_to_vectorstore(relationships)

            if len(relationships) > 0:
                return [
                    self.graph_search.relationship_to_document(relationship)
                    for relationship in relationships
                ]

        return [
            self.graph_search.node_to_document(node)
            for node in nodes
        ]
