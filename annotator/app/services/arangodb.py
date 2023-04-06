import os

from arango import ArangoClient
from arango.database import StandardDatabase
from arango.http import DefaultHTTPClient
from typing import Any, List, Optional


def create_arango_client(hosts=None) -> ArangoClient:
    # Need a custom HTTP client for Arango because the default timeout is only 60s
    class CustomHTTPClient(DefaultHTTPClient):
        REQUEST_TIMEOUT = 1000

    hosts = hosts or os.environ.get('ARANGO_HOST')
    return ArangoClient(
        hosts=hosts,
        # Without this setting any requests to Arango will fail because we don't have a valid cert
        verify_override=False,
        http_client=CustomHTTPClient()
    )


def get_db(
    arango_client: ArangoClient,
    name: Optional[str] = None,
    username: Optional[str] = None,
    password: Optional[str] = None
):
    return arango_client.db(
        name=name or os.environ.get('ARANGO_DB_NAME'),
        username=username or os.environ.get('ARANGO_USERNAME'),
        password=password or os.environ.get('ARANGO_PASSWORD'),
    )


def execute_arango_query(db: StandardDatabase, query: str, **bind_vars) -> List[Any]:
    cursor = db.aql.execute(query, ttl=600, max_runtime=600, bind_vars=bind_vars)
    return [row for row in cursor]
