import json
import multiprocessing as mp
import requests
import time

from io import BytesIO
from flask import current_app
from typing import Any, Dict, List, Tuple
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.datastructures import FileStorage

from neo4japp.database import (
    db,
    get_annotation_service,
    get_bioc_document_service,
    get_entity_recognition,
    get_manual_annotation_service
)
from neo4japp.exceptions import AnnotationError
from neo4japp.models import FileContent
from neo4japp.services.annotations.constants import (
    AnnotationMethod,
    GREEK_SYMBOLS,
    NLP_ENDPOINT,
    MAX_ABBREVIATION_WORD_LENGTH
)
from neo4japp.services.annotations.data_transfer_objects import (
    PDFWord,
    PDFTokensList,
    SpecifiedOrganismStrain
)
from neo4japp.util import normalize_str
from neo4japp.utils.logger import EventLog


"""File is to put helper functions that abstract away
multiple steps needed in the annotation pipeline.
"""


def process_nlp(
    page: int,
    page_text: str,
    pages_to_index: Dict[int, int],
    min_idx_in_page: Dict[int, int]
):
    nlp_tokens = []  # type: ignore
    combined_nlp_resp = []  # type: ignore

    # try:
    #     req = requests.post(NLP_ENDPOINT, json={'text': page_text}, timeout=30)
    #     nlp_resp = req.json()

    #     for predicted in nlp_resp:
    #         # TODO: nlp only checks for Bacteria right now
    #         # replace with Species in the future
    #         if predicted['type'] != 'Bacteria':
    #             # need to do offset here because index resets
    #             # after each text string for page
    #             offset = pages_to_index[page]
    #             curr_char_idx_mappings = {
    #                 i+offset: char for i, char in zip(
    #                     range(predicted['low_index'], predicted['high_index']),
    #                     predicted['item'],
    #                 )
    #             }

    #             # determine page keyword is on
    #             page_idx = -1
    #             min_page_idx_list = list(min_idx_in_page)
    #             for min_page_idx in min_page_idx_list:
    #                 # include offset here, see above
    #                 if predicted['high_index']+offset <= min_page_idx:
    #                     # reminder: can break here because dict in python 3.8+ are
    #                     # insertion order
    #                     break
    #                 else:
    #                     page_idx = min_page_idx
    #             token = PDFTokenPositions(
    #                 page_number=min_idx_in_page[page_idx],
    #                 keyword=predicted['item'],
    #                 normalized_keyword=normalize_str(predicted['item']),
    #                 char_positions=curr_char_idx_mappings,
    #                 token_type=predicted['type'],
    #             )
    #             nlp_tokens.append(token)

    #             offset_predicted = {k: v for k, v in predicted.items()}
    #             offset_predicted['high_index'] += offset
    #             offset_predicted['low_index'] += offset

    #             combined_nlp_resp.append(offset_predicted)

    #     req.close()
    # except requests.exceptions.ConnectTimeout:
    #     raise AnnotationError(
    #         'The request timed out while trying to connect to the NLP service.')
    # except requests.exceptions.Timeout:
    #     raise AnnotationError(
    #         'The request to the NLP service timed out.')
    # except requests.exceptions.RequestException:
    #     raise AnnotationError(
    #         'An unexpected error occurred with the NLP service.')

    return nlp_tokens, combined_nlp_resp


def get_nlp_entities(
    page_index: Dict[int, int],
    text: str,
    tokens: PDFTokensList,
):
    """Makes a call to the NLP service.
    There is a memory issue with the NLP service, so for now
    the REST call is broken into one per PDF page.

    Returns the NLP tokens and combined NLP response.
    """
    nlp_resp: List[dict] = []
    nlp_tokens: List[Any] = []
    pages_to_index = {v: k for k, v in page_index.items()}
    pages = list(pages_to_index)
    text_in_page: List[Tuple[int, str]] = []

    # TODO: Breaking the request into pages
    # because doing the entire PDF seem to cause
    # the NLP service container to crash with no
    # errors and exit code of 247... (memory related)
    length = len(pages) - 1
    for i, page in enumerate(pages):
        if i == length:
            text_in_page.append((page, text[pages_to_index[page]:]))
        else:
            text_in_page.append((page, text[pages_to_index[page]:pages_to_index[page+1]]))

    # with mp.Pool(processes=3) as pool:
    #     resources = []
    #     for page, page_text in text_in_page:
    #         resources.append(
    #             (page, page_text, pages_to_index, tokens.min_idx_in_page)
    #         )

    #     results = pool.starmap(process_nlp, resources)

    #     for result_tokens, resp in results:
    #         nlp_tokens += result_tokens
    #         nlp_resp += resp

    # current_app.logger.info(
    #     f'NLP Response Output: {json.dumps(nlp_resp)}',
    #     extra=EventLog(event_type='annotations').to_dict()
    # )

    return nlp_tokens, nlp_resp


def parse_pdf(project_id: int, file_id: str) -> Tuple[str, List[PDFWord]]:
    req = requests.get(
        f'http://pdfparser:7600/token/rect/json/http://appserver:5000/annotations/{project_id}/{file_id}', timeout=30)  # noqa
    resp = req.json()
    req.close()

    parsed = []
    pdf_text = ''
    for page in resp['pages']:
        prev_words: List[str] = []
        pdf_text += page['pageText']
        for token in page['tokens']:
            if len(prev_words) > MAX_ABBREVIATION_WORD_LENGTH:
                prev_words = []

            parsed.append(
                PDFWord(
                    keyword=token['text'],
                    normalized_keyword=token['text'],  # don't need to normalize yet
                    page_number=page['pageNo'],
                    cropbox=(page['cropBox']['height'], page['cropBox']['width']),
                    lo_location_offset=token['pgIdx'],
                    hi_location_offset=token['pgIdx'] if len(token['text']) == 1 else token['pgIdx'] + len(token['text']) - 1,  # noqa
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
                    previous_words=' '.join(prev_words[-MAX_ABBREVIATION_WORD_LENGTH:]),
                    token_type='',
                )
            )
            prev_words.append(token['text'])
    return pdf_text, parsed


def _create_annotations(
    annotation_method,
    specified_organism_synonym,
    specified_organism_tax_id,
    document,
    filename,
    project_id
):
    annotator = get_annotation_service()
    manual_annotator = get_manual_annotation_service()
    bioc_service = get_bioc_document_service()
    entity_recog = get_entity_recognition()

    custom_annotations = []
    excluded_annotations = []
    parsed = []
    pdf_text = ''

    start = time.time()
    try:
        if type(document) is str:
            # parsed = parser.parse_text(abstract=document)
            raise NotImplementedError()
        else:
            custom_annotations = document.custom_annotations
            excluded_annotations = document.excluded_annotations
            pdf_text, parsed = parse_pdf(project_id, document.file_id)
    except requests.exceptions.ConnectTimeout:
        raise AnnotationError(
            'The request timed out while trying to connect to the PDF service.')
    except requests.exceptions.Timeout:
        raise AnnotationError(
            'The request to the PDF service timed out.')
    except requests.exceptions.RequestException:
        raise AnnotationError(
            'An unexpected error occurred with the PDF service.')

    current_app.logger.info(
        f'Time to parse PDF {time.time() - start}',
        extra=EventLog(event_type='annotations').to_dict()
    )

    start = time.time()
    tokens_list = entity_recog.extract_tokens(parsed)

    if annotation_method == AnnotationMethod.RULES.value:
        entity_recog.set_entity_inclusions(custom_annotations=custom_annotations)
        entity_recog.set_entity_exclusions()

        start_lmdb_time = time.time()
        entity_recog.identify_entities(
            tokens=tokens_list.tokens,
            check_entities_in_lmdb=entity_recog.get_entities_to_identify()
        )
        current_app.logger.info(
            f'Total lmdb lookup time {time.time() - start_lmdb_time}',
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

        annotations = annotator.create_rules_based_annotations(
            tokens=tokens_list,
            custom_annotations=custom_annotations,
            excluded_annotations=excluded_annotations,
            entity_results=entity_recog.get_entity_match_results(),
            entity_type_and_id_pairs=annotator.get_entities_to_annotate(),
            specified_organism=SpecifiedOrganismStrain(
                synonym=entity_synonym, organism_id=entity_id, category=entity_category)
        )
    elif annotation_method == AnnotationMethod.NLP.value:
        nlp_tokens, nlp_resp = get_nlp_entities(
            page_index=parsed.min_idx_in_page,
            text=pdf_text,
            tokens=tokens_list
        )

        # for NLP first annotate species using rules based
        # with tokens from PDF
        entity_recog.identify_entities(
            tokens=tokens_list.tokens,
            check_entities_in_lmdb=entity_recog.get_entities_to_identify(
                anatomy=False, chemical=False, compound=False, disease=False,
                food=False, gene=False, phenotype=False, protein=False
            )
        )

        species_annotations = annotator.create_rules_based_annotations(
            tokens=tokens_list,
            custom_annotations=[],
            excluded_annotations=[],
            entity_results=entity_recog.get_entity_match_results(),
            entity_type_and_id_pairs=annotator.get_entities_to_annotate(
                anatomy=False, chemical=False, compound=False, disease=False,
                food=False, gene=False, phenotype=False, protein=False
            )
        )

        # now annotate using results from NLP
        entity_recog.identify_entities(
            tokens=nlp_tokens,
            check_entities_in_lmdb=entity_recog.get_entities_to_identify(species=False)
        )

        annotations = annotator.create_nlp_annotations(
            nlp_resp=nlp_resp,
            species_annotations=species_annotations,
            custom_annotations=custom_annotations,
            excluded_annotations=excluded_annotations,
            entity_type_and_id_pairs=annotator.get_entities_to_annotate(species=False),
        )
    else:
        raise AnnotationError(f'Your file {filename} could not be annotated.')
    bioc = bioc_service.read(text=pdf_text, file_uri=filename)

    current_app.logger.info(
        f'Time to create annotations {time.time() - start}',
        extra=EventLog(event_type='annotations').to_dict()
    )
    return pdf_text, bioc_service.generate_bioc_json(annotations=annotations, bioc=bioc)


def create_annotations(
    annotation_method,
    specified_organism_synonym,
    specified_organism_tax_id,
    document,
    filename,
    project_id
):
    _, annotations = _create_annotations(
        annotation_method=annotation_method,
        specified_organism_synonym=specified_organism_synonym,
        specified_organism_tax_id=specified_organism_tax_id,
        document=document,
        filename=filename,
        project_id=project_id
    )
    return annotations


def create_annotations2(
    annotation_method,
    specified_organism_synonym,
    specified_organism_tax_id,
    document,
    filename
):
    """Used for one-off scripts where the text is needed
    to be saved to pubtator file.

    (not used by ***ARANGO_DB_NAME*** app)
    """
    return _create_annotations(
        annotation_method,
        specified_organism_synonym,
        specified_organism_tax_id,
        document,
        filename
    )
