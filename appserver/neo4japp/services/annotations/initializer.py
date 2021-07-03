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
    ANATOMY_MESH_LMDB,
    CHEMICALS_CHEBI_LMDB,
    COMPOUNDS_BIOCYC_LMDB,
    DISEASES_MESH_LMDB,
    FOODS_MESH_LMDB,
    GENES_NCBI_LMDB,
    PHENOMENAS_MESH_LMDB,
    PHENOTYPES_CUSTOM_LMDB,
    PROTEINS_UNIPROT_LMDB,
    SPECIES_NCBI_LMDB,
)


# config identifies the subdir that has LMDB file
# once each entity type starts having multiple sources
# they will go in as subdirs (e.g chemicals/chebi, chemicals/pubchem)
configs = {
    ANATOMY_MESH_LMDB: 'anatomy',
    CHEMICALS_CHEBI_LMDB: 'chemicals',
    COMPOUNDS_BIOCYC_LMDB: 'compounds',
    DISEASES_MESH_LMDB: 'diseases',
    FOODS_MESH_LMDB: 'foods',
    GENES_NCBI_LMDB: 'genes',
    PHENOMENAS_MESH_LMDB: 'phenomenas',
    PHENOTYPES_CUSTOM_LMDB: 'phenotypes',
    PROTEINS_UNIPROT_LMDB: 'proteins',
    SPECIES_NCBI_LMDB: 'species'
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
