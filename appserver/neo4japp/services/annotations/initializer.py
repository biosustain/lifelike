from os import environ

from .annotation_service import AnnotationService
from .annotation_db_service import AnnotationDBService
from .annotation_graph_service import AnnotationGraphService
from .bioc_service import BiocDocumentService
from .enrichment_annotation_service import EnrichmentAnnotationService
from .entity_recognition import EntityRecognitionService
from .lmdb_service import LMDBService
from .tokenizer import Tokenizer

from neo4japp.database import graph

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
    SPECIES_LMDB: 'species'
}


def get_annotation_service():
    return AnnotationService(
        db=AnnotationDBService(),
        graph=AnnotationGraphService(graph)
    )


def get_annotation_db_service():
    return AnnotationDBService()


def get_annotation_graph_service():
    return AnnotationGraphService(graph)


def get_enrichment_annotation_service():
    return EnrichmentAnnotationService(
        db=AnnotationDBService(),
        graph=AnnotationGraphService(graph)
    )


def get_bioc_document_service():
    return BiocDocumentService()


def get_annotation_tokenizer():
    return Tokenizer()


def get_lmdb_service():
    return LMDBService(environ.get('LMDB_HOME_FOLDER'), **configs)


def get_recognition_service(exclusions, inclusions):
    return EntityRecognitionService(
        exclusions=exclusions,
        inclusions=inclusions,
        lmdb=LMDBService(environ.get('LMDB_HOME_FOLDER'), **configs)
    )
