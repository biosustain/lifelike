from abc import ABC, abstractmethod, ABCMeta
from typing import TypedDict


class Graph(ABC):
    @abstractmethod
    def graph(self, name: str):
        ...


class GraphRef(TypedDict):
    database_type: str
    database_name: str
