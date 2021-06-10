from os import environ

from neo4japp.services.annotations.annotation_service import AnnotationService
from neo4japp.services.annotations.annotation_db_service import AnnotationDBService
from neo4japp.services.annotations.annotation_graph_service import AnnotationGraphService
from neo4japp.services.annotations.bioc_service import BiocDocumentService
from neo4japp.services.annotations.enrichment_annotation_service import EnrichmentAnnotationService
from neo4japp.services.annotations.entity_recognition import EntityRecognitionService
from neo4japp.services.annotations.lmdb_service import LMDBService
# from neo4japp.services.annotations.manual_annotation_service import ManualAnnotationService

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


def get_annotation_service():
    return AnnotationService(
        db=AnnotationDBService(),
        graph=AnnotationGraphService()
    )


def get_enrichment_annotation_service():
    return EnrichmentAnnotationService(
        db=AnnotationDBService(),
        graph=AnnotationGraphService()
    )


def get_bioc_document_service():
    return BiocDocumentService()


def get_entity_recognition():
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
    return EntityRecognitionService(
        lmdb=LMDBService(environ.get('LMDB_HOME_FOLDER'), **configs),
        db=AnnotationDBService(),
        graph=AnnotationGraphService()
    )
