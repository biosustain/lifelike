import attr

from typing import Dict, List

from neo4japp.services.annotations.data_transfer_objects import NLPResults, PDFWord


"""Data Transfer Objects related to consolidating multiple
function parameters into one object.
"""


@attr.s(frozen=True)
class RecognitionParams():
    annotation_method: Dict[str, dict] = attr.ib()
    custom_annotations: List[dict] = attr.ib()
    excluded_annotations: List[dict] = attr.ib()
    nlp_results: NLPResults = attr.ib()
    tokens: List[PDFWord] = attr.ib()
