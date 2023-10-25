from functools import cache

from langchain.graphs import Neo4jGraph


class LazyNeo4jGraph(Neo4jGraph):
    """
    A lazy Neo4j graph wrapper that only refreshes the schema when it is accessed.
    This allows for custom schema to be set without heavy call to the database.
    """

    @cache
    def lazy_refresh_schema(self) -> None:
        """
        Refreshes the Neo4j graph schema information.
        """
        return super().refresh_schema()

    def refresh_schema(self) -> None:
        pass

    _schema: str

    @property
    def schema(self):
        if self._schema is None:
            self.lazy_refresh_schema()
        return self._schema

    @schema.setter
    def schema(self, value):
        self._schema = value
