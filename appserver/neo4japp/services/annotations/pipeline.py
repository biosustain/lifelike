import json
import multiprocessing as mp
import requests
import time

from flask import current_app
from typing import Dict, List, Set, Tuple
from string import punctuation

from neo4japp.database import (
    get_annotation_service,
    get_bioc_document_service,
    get_entity_recognition
)
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
from neo4japp.util import normalize_str
from neo4japp.utils.logger import EventLog


"""File is to put helper functions that abstract away
multiple steps needed in the annotation pipeline.
"""


def get_nlp_entities(text: str, entities: Set[str]):
    """Makes a call to the NLP service.
    There is a memory issue with the NLP service, so for now
    the REST call is broken into one per PDF page.

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
        EntityType.SPECIES.value: set(),
        'offsets_found': set()
    }

    if all([model in nlp_models for model in entities]):
        # use `all`
        req = requests.post(
            'https://nlp-api.lifelike.bio/v1/predict',
            data=json.dumps({'model': 'all', 'sentence': text}),
            headers={
                'Content-type': 'application/json',
                'secret': '***NLP_SERVICE_SECRET***'})

        resp = req.json()
        req.close()

        for results in resp['results']:
            for token in results['annotations']:
                token_offset = (token['start_pos'], token['end_pos']-1)
                entity_results['offsets_found'].add(token_offset)
                entity_results[nlp_model_types[results['model']]].add(token_offset)

                # NOTE: currently do not have these models
                # so add to them like this for now
                entity_results[EntityType.ANATOMY.value].add(token_offset)
                entity_results[EntityType.COMPOUND.value].add(token_offset)
                entity_results[EntityType.FOOD.value].add(token_offset)
                entity_results[EntityType.PHENOMENA.value].add(token_offset)
                entity_results[EntityType.PHENOTYPE.value].add(token_offset)
                entity_results[EntityType.PROTEIN.value].add(token_offset)
                entity_results[EntityType.SPECIES.value].add(token_offset)
    else:
        raise NotImplementedError()

    return NLPResults(
        anatomy=entity_results[EntityType.ANATOMY.value],
        chemicals=entity_results[EntityType.CHEMICAL.value],
        compounds=entity_results[EntityType.COMPOUND.value],
        diseases=entity_results[EntityType.DISEASE.value],
        foods=entity_results[EntityType.FOOD.value],
        genes=entity_results[EntityType.GENE.value],
        phenomenas=entity_results[EntityType.PHENOMENA.value],
        phenotypes=entity_results[EntityType.PHENOTYPE.value],
        proteins=entity_results[EntityType.PROTEIN.value],
        species=entity_results[EntityType.SPECIES.value],
        offsets_found=entity_results['offsets_found'],
    )


def read_parser_response(resp: dict) -> Tuple[str, List[PDFWord]]:
    parsed = []
    pdf_text = ''
    prev_pdf_word = None

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
                if prev_pdf_word:
                    prev_pdf_word.next = pdf_word
                parsed.append(pdf_word)
                prev_pdf_word = pdf_word
                prev_words.append(token['text'])
                if len(prev_words) > MAX_ABBREVIATION_WORD_LENGTH:
                    prev_words = prev_words[1:]
    return pdf_text, parsed


def parse_pdf(file_id: int) -> Tuple[str, List[PDFWord]]:
    req = requests.get(
        f'http://pdfparser:7600/token/rect/json/http://appserver:5000/annotations/files/{file_id}', timeout=45)  # noqa
    resp = req.json()
    req.close()

    pdf_text, parsed = read_parser_response(resp)
    return pdf_text, parsed


def parse_text(text: str) -> Tuple[str, List[PDFWord]]:
    req = requests.get(
        f'http://pdfparser:7600/token/rect/json', params={'text': text}, timeout=30)
    resp = req.json()
    req.close()

    pdf_text, parsed = read_parser_response(resp)
    return pdf_text, parsed


def _create_annotations(
    specified_organism_synonym: str,
    specified_organism_tax_id: str,
    filename: str,
    parsed: List[PDFWord],
    pdf_text: str,
    excluded_annotations: List[dict],
    custom_annotations: List[dict],
    annotation_method: Dict[str, dict]
):
    annotator = get_annotation_service()
    bioc_service = get_bioc_document_service()
    entity_recog = get_entity_recognition()

    start = time.time()

    # identify entities w/ NLP first
    nlp_results = get_nlp_entities(
        text=pdf_text,
        entities=set(k for k, v in annotation_method.items() if v['nlp']))

    start_lmdb_time = time.time()
    entity_results = entity_recog.identify(
        custom_annotations=custom_annotations,
        tokens=parsed,
        nlp_results=nlp_results
    )
    current_app.logger.info(
        f'Total LMDB lookup time {time.time() - start_lmdb_time}',
        extra=EventLog(event_type='annotations').to_dict()
    )

    entity_synonym = ''
    entity_id = ''
    entity_category = ''

    if specified_organism_synonym and specified_organism_tax_id:
        entity_synonym = normalize_str(specified_organism_synonym)
        entity_id = specified_organism_tax_id
        try:
            entity_category = json.loads(
                entity_recog.lmdb_session.species_txn.get(
                    entity_synonym.encode('utf-8')))['category']
        except (TypeError, Exception):
            # could not get data from lmdb
            current_app.logger.info(
                f'Failed to get category for fallback organism "{specified_organism_synonym}".',
                extra=EventLog(event_type='annotations').to_dict()
            )
            entity_category = 'Uncategorized'

    annotations = annotator.create_annotations(
        custom_annotations=custom_annotations,
        excluded_annotations=excluded_annotations,
        entity_results=entity_results,
        entity_type_and_id_pairs=annotator.get_entities_to_annotate(),
        specified_organism=SpecifiedOrganismStrain(
            synonym=entity_synonym, organism_id=entity_id, category=entity_category)
    )

    bioc = bioc_service.read(text=pdf_text, file_uri=filename)

    current_app.logger.info(
        f'Time to create annotations {time.time() - start}',
        extra=EventLog(event_type='annotations').to_dict()
    )
    return bioc_service.generate_bioc_json(annotations=annotations, bioc=bioc)


def create_annotations_from_pdf(
    annotation_method,
    specified_organism_synonym,
    specified_organism_tax_id,
    document,
    filename
):
    pdf_text = ''
    parsed = None

    start = time.time()
    try:
        pdf_text, parsed = parse_pdf(document.id)
    except requests.exceptions.ConnectTimeout:
        raise AnnotationError(
            'The request timed out while trying to connect to the parsing service.')
    except requests.exceptions.Timeout:
        raise AnnotationError(
            'The request to the parsing service timed out.')
    except (requests.exceptions.RequestException, Exception):
        raise AnnotationError(
            'An unexpected error occurred with the parsing service.')

    current_app.logger.info(
        f'Time to parse PDF {time.time() - start}',
        extra=EventLog(event_type='annotations').to_dict()
    )

    annotations = _create_annotations(
        annotation_method=annotation_method,
        specified_organism_synonym=specified_organism_synonym,
        specified_organism_tax_id=specified_organism_tax_id,
        filename=filename,
        parsed=parsed,
        pdf_text=pdf_text,
        custom_annotations=document.custom_annotations,
        excluded_annotations=document.excluded_annotations
    )
    return annotations


def create_annotations_from_text(
    annotation_method,
    specified_organism_synonym,
    specified_organism_tax_id,
    text
):
    pdf_text = ''
    parsed = None

    start = time.time()
    try:
        pdf_text, parsed = parse_text(text)
    except requests.exceptions.ConnectTimeout:
        raise AnnotationError(
            'The request timed out while trying to connect to the parsing service.')
    except requests.exceptions.Timeout:
        raise AnnotationError(
            'The request to the parsing service timed out.')
    except (requests.exceptions.RequestException, Exception):
        raise AnnotationError(
            'An unexpected error occurred with the parsing service.')

    current_app.logger.info(
        f'Time to parse text {time.time() - start}',
        extra=EventLog(event_type='annotations').to_dict()
    )

    annotations = _create_annotations(
        annotation_method=annotation_method,
        specified_organism_synonym=specified_organism_synonym,
        specified_organism_tax_id=specified_organism_tax_id,
        filename='text-extract',
        parsed=parsed,
        pdf_text=pdf_text,
        custom_annotations=[],
        excluded_annotations=[]
    )
    return annotations
