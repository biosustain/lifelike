from typing import List

from langchain.callbacks.manager import CallbackManagerForChainRun
from langchain.chains.retrieval_qa.base import BaseRetrievalQA, RetrievalQA
from langchain.schema import BaseRetriever
from pydantic import Field


class GraphRetrievalQA(RetrievalQA):
    retriever: BaseRetriever = Field(exclude=True)

    def _get_docs(
        self,
        question: str,
        *,
        run_manager: CallbackManagerForChainRun,
    ) -> List[Document]:
        """Get docs."""
        return self.retriever.get_relevant_documents(
            question, callbacks=run_manager.get_child()
        )

    async def _aget_docs(
        self,
        question: str,
        *,
        run_manager: AsyncCallbackManagerForChainRun,
    ) -> List[Document]:
        """Get docs."""
        return await self.retriever.aget_relevant_documents(
            question, callbacks=run_manager.get_child()
        )

    @property
    def _chain_type(self) -> str:
        """Return the chain type."""
        return "retrieval_qa"
