from neo4japp.database import (
    get_annotations_service,
    get_annotations_pdf_parser,
    get_bioc_document_service,
    get_entity_recognition
)

from neo4japp.exceptions import AnnotationError

# from neo4japp.services.annotations.annotations_pdf_parser import AnnotationsPDFParser
# from neo4japp.services.annotations.annotations_service import AnnotationsService
# from neo4japp.services.annotations.bioc_service import BiocDocumentService
# from neo4japp.services.annotations.entity_recognition import EntityRecognitionService
from neo4japp.services.annotations.constants import AnnotationMethod


def create_annotations(
    annotation_method,
    document,
    # parsed,
    source
):
    annotator = get_annotations_service()
    bioc_service = get_bioc_document_service()
    entity_recog = get_entity_recognition()
    parser = get_annotations_pdf_parser()

    try:
        if type(source) is str:
            parsed = parser.parse_text(abstract=source)
        else:
            parsed = parser.parse_pdf(pdf=source)
            source.close()
    except AnnotationError:
        raise AnnotationError(
            'Your file could not be parsed. Please check if it is a valid PDF.'
            'If it is a valid PDF, please try uploading again.')

    tokens = parser.extract_tokens(parsed_chars=parsed)
    pdf_text = parser.combine_all_chars(parsed_chars=parsed)

    entity_recog.set_entity_inclusions(custom_annotations=document.custom_annotations)

    if annotation_method == AnnotationMethod.RULES.value:
        entity_recog.identify_entities(
            tokens=tokens.token_positions,
            check_entities_in_lmdb=entity_recog.get_entities_to_identify()
        )

        annotations = annotator.create_rules_based_annotations(
            tokens=tokens,
            custom_annotations=document.custom_annotations,
            entity_results=entity_recog.get_entity_match_results(),
            entity_type_and_id_pairs=annotator.get_entities_to_annotate()
        )
    elif annotation_method == AnnotationMethod.NLP.value:
        nlp_tokens, nlp_resp = annotator.get_nlp_entities(
            page_index=parsed.min_idx_in_page,
            text=pdf_text,
            tokens=tokens,
        )

        # for NLP first annotate species using rules based
        # with tokens from PDF
        entity_recog.identify_entities(
            tokens=tokens.token_positions,
            check_entities_in_lmdb=entity_recog.get_entities_to_identify(
                chemical=False, compound=False, disease=False,
                gene=False, phenotype=False, protein=False
            )
        )

        species_annotations = annotator.create_rules_based_annotations(
            tokens=tokens,
            custom_annotations=document.custom_annotations,
            entity_results=entity_recog.get_entity_match_results(),
            entity_type_and_id_pairs=annotator.get_entities_to_annotate(
                chemical=False, compound=False, disease=False,
                gene=False, phenotype=False, protein=False
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
            custom_annotations=document.custom_annotations,
            entity_type_and_id_pairs=annotator.get_entities_to_annotate(species=False)
        )
    else:
        raise AnnotationError(f'Your file {document.filename} could not be annotated.')
    bioc = bioc_service.read(text=pdf_text, file_uri=document.filename)
    return bioc_service.generate_bioc_json(annotations=annotations, bioc=bioc)
