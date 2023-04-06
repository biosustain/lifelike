from arango import ArangoClient
from arango.http import DefaultHTTPClient
import os
from flask import g


def create_arango_client(hosts=None) -> ArangoClient:
    # Need a custom HTTP client for Arango because the default timeout is only 60s
    class CustomHTTPClient(DefaultHTTPClient):
        REQUEST_TIMEOUT = 1000

    hosts = hosts or os.getenv('ARANGO_HOST')
    return ArangoClient(
        hosts=hosts,
        # Without this setting any requests to Arango will fail because we don't have a valid cert
        verify_override=False,
        http_client=CustomHTTPClient()
    )


def get_or_create_arango_client() -> ArangoClient:
    if not hasattr(g, "arango_conn"):
        g.arango_client = create_arango_client()
    return g.arango_client