from neo4japp.database import get_or_create_arango_client

from .manual_annotation_service import ManualAnnotationService
from .sorted_annotation_service import (
    sorted_annotations_dict,
    sorted_annotations_per_file_type_dict
)
from .tokenizer import Tokenizer


def get_annotation_tokenizer():
    return Tokenizer()


def get_manual_annotation_service():
    return ManualAnnotationService(
        tokenizer=get_annotation_tokenizer(),
        arango_client=get_or_create_arango_client()
    )


def get_sorted_annotation_service(sort_id, *, mime_type=None):
    if not mime_type:
        return sorted_annotations_dict[sort_id](
            annotation_service=get_manual_annotation_service()
        )

    return sorted_annotations_per_file_type_dict[mime_type][sort_id](
            annotation_service=get_manual_annotation_service()
    )
