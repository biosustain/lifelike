from neo4japp.services.annotations.annotation_service import AnnotationService
from neo4japp.services.annotations.annotation_db_service import AnnotationDBService
from neo4japp.services.annotations.annotation_graph_service import AnnotationGraphService
from neo4japp.services.annotations.bioc_service import BiocDocumentService
from neo4japp.services.annotations.enrichment_annotation_service import EnrichmentAnnotationService
from neo4japp.services.annotations.entity_recognition import EntityRecognitionService
from neo4japp.services.annotations.lmdb_service import LMDBService
# from neo4japp.services.annotations.manual_annotation_service import ManualAnnotationService


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
    return EntityRecognitionService(
        lmdb=LMDBService(),
        db=AnnotationDBService(),
        graph=AnnotationGraphService()
    )
