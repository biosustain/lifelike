import html
import json
import time

from typing import List, Optional

from app.logs import get_logger
from app.schemas.formats.enrichment_tables import validate_enrichment_table
from app.services.constants import DEFAULT_ANNOTATION_CONFIGS
from app.services.exceptions import AnnotationError
from app.services.initializer import (
    get_annotation_service,
    get_annotation_tokenizer,
    get_bioc_document_service,
    get_enrichment_annotation_service,
    get_recognition_service,
)
from app.services.pipeline import Pipeline

logger = get_logger()


def annotate_file(
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
        logger.error(e, exc_info=True)
        logger.error(f'Could not annotate file: {file_id}')
        raise
    return {
        'file_id': file_id,
        'annotations': annotations_json
    }


def annotate_text(
    file_id: int,
    enrichment_mapping: dict,
    raw_enrichment_data: dict,
    global_exclusions: Optional[List[dict]] = None,
    local_exclusions: List[dict] = None,
    local_inclusions: List[dict] = None,
    organism_synonym: str = None,
    organism_taxonomy_id: str = None,
    annotation_configs=None
):
    """Annotate all text in enrichment table."""
    effective_annotation_configs = annotation_configs or DEFAULT_ANNOTATION_CONFIGS

    text, parsed = Pipeline.parse_text(text=enrichment_mapping['text'])

    pipeline = Pipeline(
        {
            'aers': get_recognition_service,
            'tkner': get_annotation_tokenizer,
            'as': get_enrichment_annotation_service,
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
        file_id=file_id,
        enrichment_mappings=enrichment_mapping['text_index_map']
    )

    # NOTE: code below to calculate the correct offsets for enrichment table
    # and correctly highlight based on cell is not pretty
    annotations_list = annotations_json['documents'][0]['passages'][0]['annotations']
    # sort by lo_location_offset to go from beginning to end
    sorted_annotations_list = sorted(annotations_list, key=lambda x: x['loLocationOffset'])

    prev_index = -1
    enriched_gene = ''

    start = time.time()
    for index, cell_text in enrichment_mapping['text_index_map']:
        annotation_chunk = [anno for anno in sorted_annotations_list if anno.get(
            'hiLocationOffset', None) and anno.get('hiLocationOffset') <= index]
        # it's sorted so we can do this to make the list shorter every iteration
        sorted_annotations_list = sorted_annotations_list[len(annotation_chunk):]

        # update JSON to have enrichment row and domain...
        for anno in annotation_chunk:
            if prev_index != -1:
                # only do this for subsequent cells b/c
                # first cell will always have the correct index
                # update index offset to be relative to the cell again
                # since they're relative to the combined text
                anno['loLocationOffset'] = \
                    anno['loLocationOffset'] - (prev_index + 1) - 1
                anno['hiLocationOffset'] = \
                    anno['loLocationOffset'] + anno['keywordLength'] - 1

            if 'domain' in cell_text:
                # imported should come first for each row
                if cell_text['domain'] == 'Imported':
                    enriched_gene = cell_text['text']
                anno['enrichmentGene'] = enriched_gene
                if cell_text['domain'] == 'Regulon':
                    anno['enrichmentDomain']['domain'] = cell_text['domain']
                    anno['enrichmentDomain']['subDomain'] = cell_text['label']
                else:
                    anno['enrichmentDomain']['domain'] = cell_text['domain']

        snippet = _highlight_annotations(
            original_text=cell_text['text'],
            annotations=annotation_chunk
        )
        enrichment_genes_index = raw_enrichment_data['result']['genes'][cell_text['index']]
        if cell_text['domain'] == 'Imported':
            enrichment_genes_index['annotatedImported'] = snippet
        elif cell_text['domain'] == 'Matched':
            enrichment_genes_index['annotatedMatched'] = snippet
        elif cell_text['domain'] == 'Full Name':
            enrichment_genes_index['annotatedFullName'] = snippet
        else:
            enrichment_genes_index \
                .get('domains') \
                .get(cell_text['domain']) \
                .get(cell_text['label'])['annotatedText'] = \
                snippet

        prev_index = index

    logger.info(f'Time to create enrichment snippets {time.time() - start}')

    validate_enrichment_table(raw_enrichment_data)
    return {
        'file_id': file_id,
        'annotations': annotations_json,
        'enrichment_annotations': raw_enrichment_data
    }


def _highlight_annotations(original_text: str, annotations: List[dict]):
    # If done right, we would parse the XML but the built-in XML libraries in Python
    # are susceptible to some security vulns, but because this is an internal API,
    # we can accept that it can be janky

    texts = []
    prev_ending_index = -1

    for annotation in annotations:
        meta = annotation['meta']
        meta_type = annotation['meta']['type']
        term = annotation['textInDocument']
        lo_location_offset = annotation['loLocationOffset']
        hi_location_offset = annotation['hiLocationOffset']

        text = f'<annotation type="{meta_type}" meta="{html.escape(json.dumps(meta))}">' \
                f'{term}' \
                f'</annotation>'

        if lo_location_offset == 0:
            prev_ending_index = hi_location_offset
            texts.append(text)
        else:
            if not texts:
                texts.append(original_text[:lo_location_offset])
                prev_ending_index = hi_location_offset
                texts.append(text)
            else:
                # TODO: would lo_location_offset == prev_ending_index ever happen?
                # if yes, need to handle it
                texts.append(original_text[prev_ending_index + 1:lo_location_offset])
                prev_ending_index = hi_location_offset
                texts.append(text)

    texts.append(original_text[prev_ending_index + 1:])
    final_text = ''.join(texts)
    return f'<snippet>{final_text}</snippet>'
