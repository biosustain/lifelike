import pytest

@pytest.fixture(scope='function')
def client(app):
    """Creates a HTTP client for REST actions for a test."""
    client = app.test_client()

    return client
