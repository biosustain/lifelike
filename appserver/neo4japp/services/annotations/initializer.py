from neo4japp.database import get_or_create_arango_client
from neo4japp.utils.globals import config


from .annotation_service import AnnotationService
from .annotation_db_service import AnnotationDBService
from .bioc_service import BiocDocumentService
from .enrichment_annotation_service import EnrichmentAnnotationService
from .entity_recognition import EntityRecognitionService
from .manual_annotation_service import ManualAnnotationService
from .lmdb_service import LMDBService
from .sorted_annotation_service import (
    sorted_annotations_dict,
    sorted_annotations_per_file_type_dict,
)
from .tokenizer import Tokenizer
from .constants import (
    ANATOMY_LMDB,
    CHEMICALS_LMDB,
    COMPOUNDS_LMDB,
    DISEASES_LMDB,
    FOODS_LMDB,
    GENES_LMDB,
    PHENOMENAS_LMDB,
    PHENOTYPES_LMDB,
    PROTEINS_LMDB,
    SPECIES_LMDB,
)


# config identifies the subdir that has LMDB file
# once each entity type starts having multiple sources
# they will go in as subdirs (e.g chemicals/chebi, chemicals/pubchem)
configs = {
    ANATOMY_LMDB: 'anatomy',
    CHEMICALS_LMDB: 'chemicals',
    COMPOUNDS_LMDB: 'compounds',
    DISEASES_LMDB: 'diseases',
    FOODS_LMDB: 'foods',
    GENES_LMDB: 'genes',
    PHENOMENAS_LMDB: 'phenomenas',
    PHENOTYPES_LMDB: 'phenotypes',
    PROTEINS_LMDB: 'proteins',
    SPECIES_LMDB: 'species',
}


def get_annotation_tokenizer():
    return Tokenizer()


def get_annotation_db_service():
    return AnnotationDBService()


def get_manual_annotation_service():
    return ManualAnnotationService(
        tokenizer=get_annotation_tokenizer(),
        arango_client=get_or_create_arango_client(),
    )


def get_annotation_service():
    return AnnotationService(
        db=get_annotation_db_service(),
        arango_client=get_or_create_arango_client(),
    )


def get_enrichment_annotation_service():
    return EnrichmentAnnotationService(
        db=get_annotation_db_service(),
        arango_client=get_or_create_arango_client(),
    )


def get_bioc_document_service():
    return BiocDocumentService()


def get_lmdb_service():
    return LMDBService(config.get('LMDB_HOME_FOLDER'), **configs)


def get_recognition_service(exclusions, inclusions):
    return EntityRecognitionService(
        exclusions=exclusions, inclusions=inclusions, lmdb=get_lmdb_service()
    )


def get_sorted_annotation_service(sort_id, *, mime_type=None):
    if not mime_type:
        return sorted_annotations_dict[sort_id](
            annotation_service=get_manual_annotation_service()
        )

    return sorted_annotations_per_file_type_dict[mime_type][sort_id](
        annotation_service=get_manual_annotation_service()
    )
