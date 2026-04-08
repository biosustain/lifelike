from typing import Any

from langchain.callbacks.manager import ParentRunManager
from .base import GraphRetrieverManagerMixin, GraphRetrieverHandlerProtocol


class CallbackManagerForGraphRetrieverRun(ParentRunManager, GraphRetrieverManagerMixin):
    """Callback manager for graph retriever run."""

    def on_related_nodes(self, nodes) -> Any:
        """Callback for related nodes load."""

        for handler in self.handlers:
            if isinstance(handler, GraphRetrieverHandlerProtocol):
                handler.on_related_nodes(nodes)

    def on_related_relationships(self, relationships) -> Any:
        """Callback for related relationships load."""

        for handler in self.handlers:
            if isinstance(handler, GraphRetrieverHandlerProtocol):
                handler.on_related_relationships(relationships)
