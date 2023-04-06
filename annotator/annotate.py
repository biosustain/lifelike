from typing import List, Optional

from app.logs import setup_annotator_logging
from app.services.constants import DEFAULT_ANNOTATION_CONFIGS
from app.services.exceptions import AnnotationError
from app.services.initializer import (
    get_annotation_service,
    get_annotation_tokenizer,
    get_bioc_document_service,
    get_recognition_service,
)
from app.services.pipeline import Pipeline

logger = setup_annotator_logging()


def annotate_file(
    user_id: str,
    file_id: int,
    global_exclusions: Optional[List[dict]] = None,
    local_exclusions: List[dict] = None,
    local_inclusions: List[dict] = None,
    organism_synonym: str = None,
    organism_taxonomy_id: str = None,
    annotation_configs=None
):
    effective_annotation_configs = annotation_configs or DEFAULT_ANNOTATION_CONFIGS

    try:
        text, parsed = Pipeline.parse_file(
            file_id=file_id,
            exclude_references=effective_annotation_configs['exclude_references']
        )

        pipeline = Pipeline(
            {
                'aers': get_recognition_service,
                'tkner': get_annotation_tokenizer,
                'as': get_annotation_service,
                'bs': get_bioc_document_service
            },
            text=text, parsed=parsed
        )

        annotations_json = pipeline.get_globals(
            global_exclusions=global_exclusions or [],
            local_exclusions=local_exclusions or [],
            local_inclusions=local_inclusions or []
        ).identify(
            annotation_methods=effective_annotation_configs['annotation_methods']
        ).annotate(
            specified_organism_synonym=organism_synonym or '',
            specified_organism_tax_id=organism_taxonomy_id or '',
            custom_annotations=local_inclusions or [],
            file_id=file_id
        )
        logger.debug(f'File successfully annotated: {file_id}')
    except AnnotationError as e:
        logger.error(f'Could not annotate file: {file_id}, {e}')
        raise
    return {
        'file_id': file_id,
        'user_id': user_id,
        'annotations': annotations_json
    }


# TODO: This would be used for things like enrichment tables
def annotate_text():
    raise NotImplementedError()