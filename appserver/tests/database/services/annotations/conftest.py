import pytest

from os import path

from neo4japp.services.annotations.manual_annotation_service import ManualAnnotationService
from neo4japp.services.annotations.tokenizer import Tokenizer


# reference to this directory
directory = path.realpath(path.dirname(__file__))


@pytest.fixture(scope='function')
def get_manual_annotation_service(arango_client):
    return ManualAnnotationService(
        arango_client=arango_client, tokenizer=Tokenizer())
