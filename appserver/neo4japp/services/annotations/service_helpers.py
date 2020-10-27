import json
import multiprocessing as mp
import requests
import time

from io import BytesIO
from flask import current_app
from typing import Dict, List, Tuple
from werkzeug.datastructures import FileStorage

from neo4japp.database import (
    get_annotations_service,
    get_annotations_pdf_parser,
    get_bioc_document_service,
    get_entity_recognition,
    get_annotation_neo4j,
    get_lmdb_dao
)

from neo4japp.exceptions import AnnotationError
from neo4japp.data_transfer_objects import (
    PDFTokenPositions,
    PDFTokenPositionsList,
    SpecifiedOrganismStrain
)
from neo4japp.services.annotations.constants import AnnotationMethod, NLP_ENDPOINT, EntityType
from neo4japp.services.annotations.util import normalize_str
from neo4japp.utils.logger import EventLog
from neo4japp.services.annotations.entity_recognition import EntityRecognitionService


"""File is to put helper functions that abstract away
multiple steps needed in a certain annotation pipeline.
"""


def process_nlp(
    page: int,
    page_text: str,
    pages_to_index: Dict[int, int],
    min_idx_in_page: Dict[int, int]
) -> Tuple[List[PDFTokenPositions], List[dict]]:
    nlp_tokens = []
    combined_nlp_resp = []

    try:
        req = requests.post(NLP_ENDPOINT, json={'text': page_text}, timeout=30)
        nlp_resp = req.json()

        for predicted in nlp_resp:
            # TODO: nlp only checks for Bacteria right now
            # replace with Species in the future
            if predicted['type'] != 'Bacteria':
                # need to do offset here because index resets
                # after each text string for page
                offset = pages_to_index[page]
                curr_char_idx_mappings = {
                    i+offset: char for i, char in zip(
                        range(predicted['low_index'], predicted['high_index']),
                        predicted['item'],
                    )
                }

                # determine page keyword is on
                page_idx = -1
                min_page_idx_list = list(min_idx_in_page)
                for min_page_idx in min_page_idx_list:
                    # include offset here, see above
                    if predicted['high_index']+offset <= min_page_idx:
                        # reminder: can break here because dict in python 3.8+ are
                        # insertion order
                        break
                    else:
                        page_idx = min_page_idx
                token = PDFTokenPositions(
                    page_number=min_idx_in_page[page_idx],
                    keyword=predicted['item'],
                    normalized_keyword=normalize_str(predicted['item']),
                    char_positions=curr_char_idx_mappings,
                    token_type=predicted['type'],
                )
                nlp_tokens.append(token)

                offset_predicted = {k: v for k, v in predicted.items()}
                offset_predicted['high_index'] += offset
                offset_predicted['low_index'] += offset

                combined_nlp_resp.append(offset_predicted)

        req.close()
    except requests.exceptions.ConnectTimeout:
        raise AnnotationError(
            'The request timed out while trying to connect to the NLP service.')
    except requests.exceptions.Timeout:
        raise AnnotationError(
            'The request to the NLP service timed out.')
    except requests.exceptions.RequestException:
        raise AnnotationError(
            'An unexpected error occurred with the NLP service.')

    return nlp_tokens, combined_nlp_resp


def get_nlp_entities(
    page_index: Dict[int, int],
    text: str,
    tokens: PDFTokenPositionsList,
) -> Tuple[List[PDFTokenPositions], List[dict]]:
    """Makes a call to the NLP service.
    There is a memory issue with the NLP service, so for now
    the REST call is broken into one per PDF page.

    Returns the NLP tokens and combined NLP response.
    """
    nlp_resp: List[dict] = []
    nlp_tokens: List[PDFTokenPositions] = []
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

    with mp.Pool(processes=3) as pool:
        resources = []
        for page, page_text in text_in_page:
            resources.append(
                (page, page_text, pages_to_index, tokens.min_idx_in_page)
            )

        results = pool.starmap(process_nlp, resources)

        for result_tokens, resp in results:
            nlp_tokens += result_tokens
            nlp_resp += resp

    current_app.logger.info(
        f'NLP Response Output: {json.dumps(nlp_resp)}',
        extra=EventLog(event_type='annotations').to_dict()
    )

    return nlp_tokens, nlp_resp


def process_annotations(custom_annotations, tokens, entity_type, entity_to_annotate):
    current_app.logger.info(f'Starting {mp.current_process()} for {entity_type}')

    recog = EntityRecognitionService(
        annotation_neo4j=get_annotation_neo4j(),
        lmdb_session=get_lmdb_dao()
    )
    recog.set_entity_inclusions(custom_annotations=custom_annotations)
    recog.identify_entities(tokens, entity_to_annotate)

    if entity_type == EntityType.CHEMICAL.value:
        return recog.matched_chemicals
    elif entity_type == EntityType.COMPOUND.value:
        return recog.matched_compounds
    elif entity_type == EntityType.DISEASE.value:
        return recog.matched_diseases
    elif entity_type == EntityType.FOOD.value:
        return recog.matched_foods
    elif entity_type == EntityType.GENE.value:
        return recog.matched_genes
    elif entity_type == EntityType.PHENOTYPE.value:
        return recog.matched_phenotypes
    elif entity_type == EntityType.PROTEIN.value:
        return recog.matched_proteins
    elif entity_type == EntityType.SPECIES.value:
        return recog.matched_species


def create_annotations(
    annotation_method,
    specified_organism_synonym,
    specified_organism_tax_id,
    document,
    filename,
    # set to false for now since it doesn't
    # seem to be any better (but keep code in case need in the future)
    parallel=False
):
    annotator = get_annotations_service()
    bioc_service = get_bioc_document_service()
    entity_recog = get_entity_recognition()
    parser = get_annotations_pdf_parser()

    custom_annotations = []

    start = time.time()
    try:
        if type(document) is str:
            parsed = parser.parse_text(abstract=document)
        else:
            fp = FileStorage(BytesIO(document.raw_file), filename)
            parsed = parser.parse_pdf(pdf=fp)
            fp.close()
            custom_annotations = document.custom_annotations
    except AnnotationError:
        raise AnnotationError(
            'Your file could not be parsed. Please check if it is a valid PDF.'
            'If it is a valid PDF, please try uploading again.')

    current_app.logger.info(
        f'Time to parse PDF {time.time() - start}',
        extra=EventLog(event_type='annotations').to_dict()
    )

    start = time.time()
    tokens = parser.extract_tokens(parsed_chars=parsed)
    pdf_text = parser.combine_all_chars(parsed_chars=parsed)

    tokens_list = list(tokens.token_positions)

    if annotation_method == AnnotationMethod.RULES.value:
        if parallel:
            with mp.Pool(processes=4) as pool:
                results = pool.starmap(
                    process_annotations,
                    [
                        (custom_annotations, tokens_list, EntityType.CHEMICAL.value, {EntityType.CHEMICAL.value: True}),  # noqa
                        (custom_annotations, tokens_list, EntityType.COMPOUND.value, {EntityType.COMPOUND.value: True}),  # noqa
                        (custom_annotations, tokens_list, EntityType.DISEASE.value, {EntityType.DISEASE.value: True}),  # noqa
                        (custom_annotations, tokens_list, EntityType.FOOD.value, {EntityType.FOOD.value: True}),  # noqa
                        (custom_annotations, tokens_list, EntityType.GENE.value, {EntityType.GENE.value: True}),  # noqa
                        (custom_annotations, tokens_list, EntityType.PHENOTYPE.value, {EntityType.PHENOTYPE.value: True}),  # noqa
                        (custom_annotations, tokens_list, EntityType.PROTEIN.value, {EntityType.PROTEIN.value: True}),  # noqa
                        (custom_annotations, tokens_list, EntityType.SPECIES.value, {EntityType.SPECIES.value: True})  # noqa
                    ]
                )
                entity_recog.matched_chemicals = results[0]
                entity_recog.matched_compounds = results[1]
                entity_recog.matched_diseases = results[2]
                entity_recog.matched_foods = results[3]
                entity_recog.matched_genes = results[4]
                entity_recog.matched_phenotypes = results[5]
                entity_recog.matched_proteins = results[6]
                entity_recog.matched_species = results[7]
        else:
            entity_recog.set_entity_inclusions(custom_annotations=custom_annotations)
            entity_recog.identify_entities(
                tokens=tokens_list,
                check_entities_in_lmdb=entity_recog.get_entities_to_identify()
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
            tokens=tokens,
            custom_annotations=custom_annotations,
            entity_results=entity_recog.get_entity_match_results(),
            entity_type_and_id_pairs=annotator.get_entities_to_annotate(),
            specified_organism=SpecifiedOrganismStrain(
                synonym=entity_synonym, organism_id=entity_id, category=entity_category)
        )
    elif annotation_method == AnnotationMethod.NLP.value:
        nlp_tokens, nlp_resp = get_nlp_entities(
            page_index=parsed.min_idx_in_page,
            text=pdf_text,
            tokens=tokens
        )

        # for NLP first annotate species using rules based
        # with tokens from PDF
        entity_recog.identify_entities(
            tokens=tokens.token_positions,
            check_entities_in_lmdb=entity_recog.get_entities_to_identify(
                anatomy=False, chemical=False, compound=False, disease=False,
                food=False, gene=False, phenotype=False, protein=False
            )
        )

        species_annotations = annotator.create_rules_based_annotations(
            tokens=tokens,
            custom_annotations=custom_annotations,
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
            char_coord_objs_in_pdf=tokens.char_coord_objs_in_pdf,
            cropbox_in_pdf=tokens.cropbox_in_pdf,
            custom_annotations=custom_annotations,
            entity_type_and_id_pairs=annotator.get_entities_to_annotate(species=False),
            word_index_dict=tokens.word_index_dict
        )
    else:
        raise AnnotationError(f'Your file {filename} could not be annotated.')
    bioc = bioc_service.read(text=pdf_text, file_uri=filename)

    current_app.logger.info(
        f'Time to create annotations {time.time() - start}',
        extra=EventLog(event_type='annotations').to_dict()
    )
    return annotations, bioc_service.generate_bioc_json(annotations=annotations, bioc=bioc)
