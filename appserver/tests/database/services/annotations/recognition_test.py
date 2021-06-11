# import json

# from os import path

# from neo4japp.services.annotations.data_transfer_objects import NLPResults
# from neo4japp.services.annotations.util import process_parsed_content


# # reference to this directory
# directory = path.realpath(path.dirname(__file__))


# def test_lmdb_vascular_cell_adhesion(
#     vascular_cell_adhesion_lmdb_setup,
#     get_annotation_tokenizer,
#     get_entity_service
# ):
#     entity_service = get_entity_service
#     tokenizer = get_annotation_tokenizer

#     pdf = path.join(directory, 'pdf_samples/recognition_test/test_lmdb_vascular_cell_adhesion.json')

#     with open(pdf, 'rb') as f:
#         parsed = json.load(f)

#     results = entity_service.identify(
#         custom_annotations=[],
#         excluded_annotations=[],
#         tokens=tokenizer.create(process_parsed_content(parsed)[1]),
#         nlp_results=NLPResults()
#     )

#     assert len(results.recognized_proteins) == 2
