import json
import multiprocessing as mp
import requests
import time

from flask import current_app
from typing import Dict, List, Set, Tuple
from string import punctuation

from neo4japp.constants import LogEventType
from neo4japp.exceptions import AnnotationError
from neo4japp.services.annotations.constants import (
    EntityType,
    MAX_ABBREVIATION_WORD_LENGTH
)
from neo4japp.services.annotations.data_transfer_objects import (
    NLPResults,
    PDFWord,
    SpecifiedOrganismStrain
)
from neo4japp.services.annotations.initializer import (
    get_annotation_service,
    get_bioc_document_service,
    get_enrichment_annotation_service,
    get_entity_recognition
)
from neo4japp.util import normalize_str
from neo4japp.utils.logger import EventLog


"""File is to put helper functions that abstract away
multiple steps needed in the annotation pipeline.
"""


def call_nlp_service(model: str, text: str) -> dict:
    req = requests.post(
        'https://nlp-api.lifelike.bio/v1/predict',
        data=json.dumps({'model': model, 'sentence': text}),
        headers={
            'Content-type': 'application/json',
            'secret': 'dGhpcyBpcyB2ZXJ5IHNlY3JldCBmb3IgbmxwIGFwaQ=='},
        timeout=60)

    resp = req.json()
    req.close()
    return resp


def get_nlp_entities(text: str, entities: Set[str]):
    """Makes a call to the NLP service.
    Returns the set of entity types in which the token was found.
    """
    if not entities:
        return NLPResults()

    nlp_models = {
        EntityType.CHEMICAL.value: 'bc2gm_v1_chem',
        EntityType.GENE.value: 'bc2gm_v1_gene',
        # TODO: disease has two models
        # for now use ncbi because it has better results
        EntityType.DISEASE.value: 'bc2gm_v1_ncbi_disease'
    }

    nlp_model_types = {
        'bc2gm_v1_chem': EntityType.CHEMICAL.value,
        'bc2gm_v1_gene': EntityType.GENE.value,
        'bc2gm_v1_ncbi_disease': EntityType.DISEASE.value,
        'bc2gm_v1_bc5cdr_disease': EntityType.DISEASE.value
    }

    entity_results: Dict[str, set] = {
        EntityType.ANATOMY.value: set(),
        EntityType.CHEMICAL.value: set(),
        EntityType.COMPOUND.value: set(),
        EntityType.DISEASE.value: set(),
        EntityType.FOOD.value: set(),
        EntityType.GENE.value: set(),
        EntityType.PHENOMENA.value: set(),
        EntityType.PHENOTYPE.value: set(),
        EntityType.PROTEIN.value: set(),
        EntityType.SPECIES.value: set()
    }

    models = []
    start = time.time()
    if all([model in entities for model in nlp_models]):
        req = call_nlp_service(model='all', text=text)
        models = [req]
    else:
        with mp.Pool(processes=4) as pool:
            models = pool.starmap(
                call_nlp_service, [(
                    nlp_models[model],
                    text
                ) for model in entities if nlp_models.get(model, None)])

    current_app.logger.info(
        f'Total NLP time {time.time() - start}',
        extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
    )

    for model in models:
        for results in model['results']:
            for token in results['annotations']:
                token_offset = (token['start_pos'], token['end_pos']-1)
                entity_results[nlp_model_types[results['model']]].add(token_offset)

    return NLPResults(
        anatomy=entity_results[EntityType.ANATOMY.value],
        chemicals=entity_results[EntityType.CHEMICAL.value],
        # compound will use chemical
        compounds=entity_results[EntityType.CHEMICAL.value],
        diseases=entity_results[EntityType.DISEASE.value],
        foods=entity_results[EntityType.FOOD.value],
        genes=entity_results[EntityType.GENE.value],
        phenomenas=entity_results[EntityType.PHENOMENA.value],
        phenotypes=entity_results[EntityType.PHENOTYPE.value],
        proteins=entity_results[EntityType.PROTEIN.value],
        species=entity_results[EntityType.SPECIES.value],
    )


def read_parser_response(resp: dict) -> Tuple[str, List[PDFWord]]:
    parsed = []
    pdf_text = ''

    for page in resp['pages']:
        prev_words: List[str] = []
        pdf_text += page['pageText']
        for token in page['tokens']:
            # for now ignore any rotated words
            if token['text'] not in punctuation and all([rect['rotation'] == 0 for rect in token['rects']]):  # noqa
                pdf_word = PDFWord(
                    keyword=token['text'],
                    normalized_keyword=token['text'],  # don't need to normalize yet
                    page_number=page['pageNo'],
                    lo_location_offset=token['pgIdx'],
                    hi_location_offset=token['pgIdx'] if len(
                        token['text']) == 1 else token['pgIdx'] + len(token['text']) - 1,  # noqa
                    heights=[rect['height'] for rect in token['rects']],
                    widths=[rect['width'] for rect in token['rects']],
                    coordinates=[
                        [
                            rect['lowerLeftPt']['x'],
                            rect['lowerLeftPt']['y'],
                            rect['lowerLeftPt']['x'] + rect['width'],
                            rect['lowerLeftPt']['y'] + rect['height']
                        ] for rect in token['rects']
                    ],
                    previous_words=' '.join(
                        prev_words[-MAX_ABBREVIATION_WORD_LENGTH:]) if token['possibleAbbrev'] else '',  # noqa
                )
                parsed.append(pdf_word)
                prev_words.append(token['text'])
                if len(prev_words) > MAX_ABBREVIATION_WORD_LENGTH:
                    prev_words = prev_words[1:]
    return pdf_text, parsed


def parse_pdf(file_id: int, exclude_references: bool) -> Tuple[str, List[PDFWord]]:
    req = requests.post(
        f'http://pdfparser:7600/token/rect/json/',
        data={
            'fileUrl': f'http://appserver:5000/annotations/files/{file_id}',
            'excludeReferences': exclude_references
        }, timeout=60)
    resp = req.json()
    req.close()

    pdf_text, parsed = read_parser_response(resp)
    return pdf_text, parsed


def parse_text(text: str) -> Tuple[str, List[PDFWord]]:
    req = requests.post(
        f'http://pdfparser:7600/token/rect/text/json', data={'text': text}, timeout=30)
    resp = req.json()
    req.close()

    pdf_text, parsed = read_parser_response(resp)
    return pdf_text, parsed


def _create_fallback_organism(
    specified_organism_synonym: str,
    specified_organism_tax_id: str
):
    entity_synonym = ''
    entity_id = ''
    entity_category = ''

    entity_recog = get_entity_recognition()

    if specified_organism_synonym and specified_organism_tax_id:
        entity_synonym = normalize_str(specified_organism_synonym)
        entity_id = specified_organism_tax_id
        try:
            entity_category = json.loads(
                entity_recog.lmdb.session.species_txn.get(
                    entity_synonym.encode('utf-8')))['category']
        except (TypeError, Exception):
            # could not get data from lmdb
            current_app.logger.info(
                f'Failed to get category for fallback organism "{specified_organism_synonym}".',
                extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
            )
            entity_category = 'Uncategorized'
    return SpecifiedOrganismStrain(
        synonym=entity_synonym, organism_id=entity_id, category=entity_category)


def _identify_entities(
    parsed: List[PDFWord],
    pdf_text: str,
    excluded_annotations: List[dict],
    custom_annotations: List[dict],
    annotation_method: Dict[str, dict]
):
    entity_recog = get_entity_recognition()

    # identify entities w/ NLP first
    try:
        nlp_start_time = time.time()
        nlp_results = get_nlp_entities(
            text=pdf_text,
            entities=set(k for k, v in annotation_method.items() if v['nlp']))
        current_app.logger.info(
            f'Total NLP processing time {time.time() - nlp_start_time}',
            extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
        )
    except Exception:
        raise AnnotationError(
            'Unable to Annotate',
            'An unexpected error occurred with the NLP service.')

    start = time.time()
    entity_results = entity_recog.identify(
        custom_annotations=custom_annotations,
        excluded_annotations=excluded_annotations,
        tokens=parsed,
        nlp_results=nlp_results
    )
    current_app.logger.info(
        f'Total LMDB lookup time {time.time() - start}',
        extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
    )
    return entity_results


def create_annotations_from_pdf(
    annotation_configs,
    specified_organism_synonym,
    specified_organism_tax_id,
    document,
    filename
):
    annotator = get_annotation_service()
    bioc_service = get_bioc_document_service()

    pdf_text = ''
    parsed = None

    start = time.time()
    try:
        pdf_text, parsed = parse_pdf(document.id, annotation_configs['exclude_references'])
    except requests.exceptions.ConnectTimeout:
        raise AnnotationError(
            'Unable to Annotate',
            'The request timed out while trying to connect to the parsing service.')
    except requests.exceptions.Timeout:
        raise AnnotationError(
            'Unable to Annotate',
            'The request to the parsing service timed out.')
    except (requests.exceptions.RequestException, Exception):
        raise AnnotationError(
            'Unable to Annotate',
            'An unexpected error occurred with the parsing service.')

    current_app.logger.info(
        f'Time to parse PDF {time.time() - start}',
        extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
    )

    entities = _identify_entities(
        parsed=parsed,
        pdf_text=pdf_text,
        excluded_annotations=document.excluded_annotations,
        custom_annotations=document.custom_annotations,
        annotation_method=annotation_configs['annotation_methods']
    )

    fallback_organism = _create_fallback_organism(
        specified_organism_synonym=specified_organism_synonym,
        specified_organism_tax_id=specified_organism_tax_id
    )

    start = time.time()
    annotations = annotator.create_annotations(
        custom_annotations=document.custom_annotations,
        entity_results=entities,
        entity_type_and_id_pairs=annotator.get_entities_to_annotate(),
        specified_organism=fallback_organism
    )

    current_app.logger.info(
        f'Time to create annotations {time.time() - start}',
        extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
    )

    bioc = bioc_service.read(text=pdf_text, file_uri=filename)
    return bioc_service.generate_bioc_json(annotations=annotations, bioc=bioc)


def create_annotations_from_text(
    annotation_configs,
    specified_organism_synonym,
    specified_organism_tax_id,
    text
):
    annotator = get_annotation_service()
    bioc_service = get_bioc_document_service()

    pdf_text = ''
    parsed = None

    start = time.time()
    try:
        pdf_text, parsed = parse_text(text)
    except requests.exceptions.ConnectTimeout:
        raise AnnotationError(
            'Unable to Annotate',
            'The request timed out while trying to connect to the parsing service.')
    except requests.exceptions.Timeout:
        raise AnnotationError(
            'Unable to Annotate',
            'The request to the parsing service timed out.')
    except (requests.exceptions.RequestException, Exception):
        raise AnnotationError(
            'Unable to Annotate',
            'An unexpected error occurred with the parsing service.')

    current_app.logger.info(
        f'Time to parse text {time.time() - start}',
        extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
    )

    entities = _identify_entities(
        parsed=parsed,
        pdf_text=pdf_text,
        excluded_annotations=[],
        custom_annotations=[],
        annotation_method=annotation_configs['annotation_methods']
    )

    fallback_organism = _create_fallback_organism(
        specified_organism_synonym=specified_organism_synonym,
        specified_organism_tax_id=specified_organism_tax_id
    )

    start = time.time()
    annotations = annotator.create_annotations(
        custom_annotations=[],
        entity_results=entities,
        entity_type_and_id_pairs=annotator.get_entities_to_annotate(),
        specified_organism=fallback_organism
    )

    current_app.logger.info(
        f'Time to create annotations {time.time() - start}',
        extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
    )

    bioc = bioc_service.read(text=pdf_text, file_uri='text-extract')
    return bioc_service.generate_bioc_json(annotations=annotations, bioc=bioc)


def create_annotations_from_enrichment_table(
    annotation_configs,
    specified_organism_synonym,
    specified_organism_tax_id,
    enrichment_mappings,
    text
):
    annotator = get_enrichment_annotation_service()
    bioc_service = get_bioc_document_service()

    pdf_text = ''
    parsed = None

    start = time.time()
    try:
        pdf_text, parsed = parse_text(text)
    except requests.exceptions.ConnectTimeout:
        raise AnnotationError(
            'Unable to Annotate',
            'The request timed out while trying to connect to the parsing service.')
    except requests.exceptions.Timeout:
        raise AnnotationError(
            'Unable to Annotate',
            'The request to the parsing service timed out.')
    except (requests.exceptions.RequestException, Exception):
        raise AnnotationError(
            'Unable to Annotate',
            'An unexpected error occurred with the parsing service.')

    current_app.logger.info(
        f'Time to parse text {time.time() - start}',
        extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
    )

    entities = _identify_entities(
        parsed=parsed,
        pdf_text=pdf_text,
        custom_annotations=[],
        excluded_annotations=[],
        annotation_method=annotation_configs['annotation_methods']
    )

    fallback_organism = _create_fallback_organism(
        specified_organism_synonym=specified_organism_synonym,
        specified_organism_tax_id=specified_organism_tax_id
    )

    start = time.time()
    annotations = annotator.create_annotations(
        custom_annotations=[],
        entity_results=entities,
        entity_type_and_id_pairs=annotator.get_entities_to_annotate(),
        specified_organism=fallback_organism,
        enrichment_mappings=enrichment_mappings
    )

    current_app.logger.info(
        f'Time to create annotations {time.time() - start}',
        extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
    )

    bioc = bioc_service.read(text=pdf_text, file_uri='text-extract')
    return bioc_service.generate_bioc_json(annotations=annotations, bioc=bioc)
