from abc import ABC, abstractmethod
from typing import List, TypeVar, Generic

from langchain.schema import Document
from pydantic.v1 import BaseModel

NODE = TypeVar("NODE")
RELATIONSHIP = TypeVar("RELATIONSHIP")


class GraphSearchAPIWrapper(ABC, Generic[NODE, RELATIONSHIP], BaseModel):
    """Abstract class for graph search API wrappers."""

    @abstractmethod
    def node_to_document(self, node: NODE) -> Document:
        ...

    @abstractmethod
    def relationship_to_document(self, relationship: RELATIONSHIP) -> Document:
        ...

    @abstractmethod
    def get_related_nodes(self, terms: List[str]) -> List[NODE]:
        ...

    @abstractmethod
    def get_relationships(self, nodes: List[NODE]) -> List[RELATIONSHIP]:
        ...
