import json
import multiprocessing as mp
import requests
import time

from flask import current_app
from typing import Dict, List, Set

from neo4japp.constants import LogEventType
from neo4japp.exceptions import AnnotationError
from neo4japp.util import normalize_str
from neo4japp.utils.logger import EventLog

from .constants import EntityType, SPECIES_NCBI_LMDB
from .data_transfer_objects import (
    NLPResults,
    PDFWord,
    SpecifiedOrganismStrain
)
from .initializer import *
from .util import parse_content


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


def _create_fallback_organism(
    specified_organism_synonym: str,
    specified_organism_tax_id: str
):
    entity_synonym = ''
    entity_id = ''
    entity_category = ''

    lmdb_service = get_lmdb_service()

    if specified_organism_synonym and specified_organism_tax_id:
        entity_synonym = normalize_str(specified_organism_synonym)
        entity_id = specified_organism_tax_id
        try:
            with lmdb_service.open_db(SPECIES_NCBI_LMDB) as txn:
                entity_category = json.loads(
                    txn.get(entity_synonym.encode('utf-8')))['category']
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
    db_service = get_annotation_db_service()
    graph_service = get_annotation_graph_service()

    start = time.time()
    exclusions = db_service.get_entity_exclusions(excluded_annotations)
    inclusions = graph_service.get_entity_inclusions(custom_annotations)
    current_app.logger.info(
        f'Time to process entity exclusions/inclusions {time.time() - start}',
        extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
    )

    entity_recog = get_recognition_service(exclusions=exclusions, inclusions=inclusions)
    tokenizer = get_annotation_tokenizer()

    # identify entities w/ NLP first
    entities_to_run_nlp = set(k for k, v in annotation_method.items() if v['nlp'])
    try:
        nlp_start_time = time.time()
        nlp_results = get_nlp_entities(
            text=pdf_text,
            entities=entities_to_run_nlp)
        current_app.logger.info(
            f'Total NLP processing time {time.time() - nlp_start_time}',
            extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
        )
    except Exception:
        raise AnnotationError(
            'Unable to Annotate',
            'An unexpected error occurred with the NLP service.')

    start = time.time()
    tokens = tokenizer.create(parsed)
    current_app.logger.info(
        f'Time to tokenize PDF words {time.time() - start}',
        extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
    )

    start = time.time()
    entity_results = entity_recog.identify(tokens=tokens, nlp_results=nlp_results)
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
        pdf_text, parsed = parse_content(
            file_id=document.id,
            exclude_references=annotation_configs['exclude_references'])
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
        pdf_text, parsed = parse_content('text', text=text)
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
        pdf_text, parsed = parse_content('text', text=text)
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
