import json

from os import path

from neo4japp.services.annotations.data_transfer_objects import NLPResults
from neo4japp.services.annotations.pipeline import read_parser_response


# reference to this directory
directory = path.realpath(path.dirname(__file__))


def test_lmdb_vascular_cell_adhesion(
    vascular_cell_adhesion_lmdb_setup,
    get_entity_service
):
    entity_service = get_entity_service

    pdf = path.join(directory, 'pdf_samples/recognition_test/test_lmdb_vascular_cell_adhesion.json')

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    results = entity_service.identify(
        custom_annotations=[],
        excluded_annotations=[],
        tokens=read_parser_response(parsed)[1],
        nlp_results=NLPResults()
    )

    assert len(results.recognized_proteins) == 2
