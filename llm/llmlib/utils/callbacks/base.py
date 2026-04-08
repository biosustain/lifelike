from abc import abstractmethod
from typing import Any, Type, List, Protocol, runtime_checkable

from langchain.callbacks.base import BaseCallbackHandler
from langchain.callbacks.manager import CallbackManager


@runtime_checkable
class GraphRetrieverHandlerProtocol(Protocol):
    @abstractmethod
    def on_related_nodes(self, nodes) -> Any:
        """Callback for related nodes load."""

    @abstractmethod
    def on_related_relationships(self, relationships) -> Any:
        """Callback for related relationships load."""


class GraphRetrieverManagerMixin:
    nodes: Any
    relationships: Any

    def on_related_nodes(self, nodes) -> Any:
        """Callback for related nodes load."""
        self.nodes = nodes

    def on_related_relationships(self, relationships) -> Any:
        """Callback for related relationships load."""
        self.relationships = relationships


class GraphCallbackManager:
    handlers: List[BaseCallbackHandler]

    @classmethod
    def from_callback_manager(cls, callback_manager: Type[CallbackManager], **kwargs) -> Any:
        return type(
            'GraphCallbackManager',
            (callback_manager, GraphCallbackManager),
            kwargs
        )

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
