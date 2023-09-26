from abc import ABC
from functools import lru_cache

from llmlib.interfaces import Graph
from llmlib.utils.config import config

from llmlib.utils.singleton import Singleton


class Neo4j(Graph, metaclass=Singleton):
    @lru_cache(maxsize=1)
    def graph(self, name: str = None):
        from langchain.graphs import Neo4jGraph
        host = config.get('NEO4J_HOST')
        scheme = config.get('NEO4J_SCHEME')
        port = config.get('NEO4J_PORT')
        url = f'{scheme}://{host}:{port}'
        username, password = config.get('NEO4J_AUTH', 'neo4j/password').split('/')
        return Neo4jGraph(
            url=url,
            username=username,
            password=password,
            database=name or config.get('NEO4J_DATABASE', 'neo4j'),
        )


class Arango(Graph, metaclass=Singleton):
    _client = None

    @property
    def client(self):
        if self._client is None:
            from arango import ArangoClient
            self._client = ArangoClient(
                hosts=config.get('ARANGO_HOST')
            )
        return self._client

    @lru_cache(maxsize=1)
    def db(self, name: str = None):
        return self.client.db(
            name=name or config.get('ARANGO_DB_NAME', '_system'),
            username=config.get('ARANGO_USERNAME', '***ARANGO_USERNAME***'),
            password=config.get('ARANGO_PASSWORD', 'password'),
        )

    @lru_cache(maxsize=1)
    def graph(self, name: str = None):
        from langchain.graphs import ArangoGraph
        return ArangoGraph(self.db(name))

    def __del__(self):
        if self._client is not None:
            self._client.close()


class RedisCache(ABC):
    _client = None

    @classmethod
    def client(cls):
        if cls._client is None:
            from redis import Redis, BlockingConnectionPool
            cls._client = Redis(
                connection_pool=BlockingConnectionPool.from_url(
                    config.get('CACHE_REDIS_URL')
                )
            )
        return cls._client

    def __del__(self):
        if self._client is not None:
            self._client.close()
