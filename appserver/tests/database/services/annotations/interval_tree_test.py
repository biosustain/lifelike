import pytest

from neo4japp.data_transfer_objects import Annotation
from neo4japp.services.annotations import (
    AnnotationsService,
    LMDBDao,
)
from neo4japp.services.annotations.annotation_interval_tree import (
    AnnotationInterval,
    AnnotationIntervalTree,
)
from neo4japp.services.annotations.constants import EntityType


def create_tree(annotations, tree):
    for annotation in annotations:
        tree.add(
            AnnotationInterval(
                begin=annotation.lo_location_offset,
                end=annotation.hi_location_offset,
                data=annotation,
            ),
        )
    return tree


@pytest.mark.parametrize(
    'annotations',
    [
        [
            Annotation(
                page_number=1,
                keyword='word a',
                lo_location_offset=17,
                hi_location_offset=22,
                keyword_length=6,
                keywords=[''],
                rects=[[1, 2]],
                meta=Annotation.Meta(
                    keyword_type=EntityType.Chemical.value,
                    color='',
                    id='',
                    id_type='',
                    id_hyperlink='',
                    links=Annotation.Meta.Links(),
                ),
            ),
            Annotation(
                page_number=1,
                keyword='a long word',
                lo_location_offset=22,
                hi_location_offset=32,
                keyword_length=10,
                keywords=[''],
                rects=[[1, 2]],
                meta=Annotation.Meta(
                    keyword_type=EntityType.Chemical.value,
                    color='',
                    id='',
                    id_type='',
                    id_hyperlink='',
                    links=Annotation.Meta.Links(),
                ),
            ),
        ],
    ],
)
def test_merge_adjacent_intervals_with_same_type(annotations_setup, annotations):
    annotation_service = AnnotationsService(
        lmdb_session=LMDBDao(
            genes_lmdb_path='',
            chemicals_lmdb_path='',
            compounds_lmdb_path='',
            proteins_lmdb_path='',
            species_lmdb_path='',
            diseases_lmdb_path='',
            phenotypes_lmdb_path='',
        ),
    )
    tree = create_tree(annotations=annotations, tree=AnnotationIntervalTree())
    fixed = tree.merge_overlaps(data_reducer=annotation_service.determine_entity_precedence)
    assert len(fixed) == 1
    assert fixed[0] == annotations[1]


@pytest.mark.parametrize(
    'annotations',
    [
        [
            Annotation(
                page_number=1,
                keyword='word a',
                lo_location_offset=17,
                hi_location_offset=22,
                keyword_length=6,
                keywords=[''],
                rects=[[1, 2]],
                meta=Annotation.Meta(
                    keyword_type=EntityType.Chemical.value,
                    color='',
                    id='',
                    id_type='',
                    id_hyperlink='',
                    links=Annotation.Meta.Links(),
                ),
            ),
            Annotation(
                page_number=1,
                keyword='a long word',
                lo_location_offset=22,
                hi_location_offset=32,
                keyword_length=10,
                keywords=[''],
                rects=[[1, 2]],
                meta=Annotation.Meta(
                    keyword_type=EntityType.Protein.value,
                    color='',
                    id='',
                    id_type='',
                    id_hyperlink='',
                    links=Annotation.Meta.Links(),
                ),
            ),
        ],
    ],
)
def test_merge_adjacent_intervals_with_different_type(annotations_setup, annotations):
    annotation_service = AnnotationsService(
        lmdb_session=LMDBDao(
            genes_lmdb_path='',
            chemicals_lmdb_path='',
            compounds_lmdb_path='',
            proteins_lmdb_path='',
            species_lmdb_path='',
            diseases_lmdb_path='',
            phenotypes_lmdb_path='',
        ),
    )
    tree = create_tree(annotations=annotations, tree=AnnotationIntervalTree())
    fixed = tree.merge_overlaps(data_reducer=annotation_service.determine_entity_precedence)
    assert len(fixed) == 1
    assert fixed[0] == annotations[1]


@pytest.mark.parametrize(
    'annotations',
    [
        [
            Annotation(
                page_number=1,
                keyword='word a',
                lo_location_offset=17,
                hi_location_offset=22,
                keyword_length=6,
                keywords=[''],
                rects=[[1, 2]],
                meta=Annotation.Meta(
                    keyword_type=EntityType.Chemical.value,
                    color='',
                    id='',
                    id_type='',
                    id_hyperlink='',
                    links=Annotation.Meta.Links(),
                ),
            ),
            Annotation(
                page_number=1,
                keyword='word a',
                lo_location_offset=17,
                hi_location_offset=22,
                keyword_length=6,
                keywords=[''],
                rects=[[1, 2]],
                meta=Annotation.Meta(
                    keyword_type=EntityType.Chemical.value,
                    color='',
                    id='',
                    id_type='',
                    id_hyperlink='',
                    links=Annotation.Meta.Links(),
                ),
            ),
        ],
    ],
)
def test_merge_equal_intervals_with_same_type(annotations_setup, annotations):
    annotation_service = AnnotationsService(
        lmdb_session=LMDBDao(
            genes_lmdb_path='',
            chemicals_lmdb_path='',
            compounds_lmdb_path='',
            proteins_lmdb_path='',
            species_lmdb_path='',
            diseases_lmdb_path='',
            phenotypes_lmdb_path='',
        ),
    )
    tree = create_tree(annotations=annotations, tree=AnnotationIntervalTree())
    fixed = tree.merge_overlaps(data_reducer=annotation_service.determine_entity_precedence)
    assert len(fixed) == 1
    assert fixed[0] == annotations[1]


@pytest.mark.parametrize(
    'annotations',
    [
        [
            Annotation(
                page_number=1,
                keyword='word a',
                lo_location_offset=17,
                hi_location_offset=22,
                keyword_length=6,
                keywords=[''],
                rects=[[1, 2]],
                meta=Annotation.Meta(
                    keyword_type=EntityType.Gene.value,
                    color='',
                    id='',
                    id_type='',
                    id_hyperlink='',
                    links=Annotation.Meta.Links(),
                ),
            ),
            Annotation(
                page_number=1,
                keyword='word a',
                lo_location_offset=17,
                hi_location_offset=22,
                keyword_length=6,
                keywords=[''],
                rects=[[1, 2]],
                meta=Annotation.Meta(
                    keyword_type=EntityType.Chemical.value,
                    color='',
                    id='',
                    id_type='',
                    id_hyperlink='',
                    links=Annotation.Meta.Links(),
                ),
            ),
        ],
    ],
)
def test_merge_equal_intervals_with_different_type(annotations_setup, annotations):
    annotation_service = AnnotationsService(
        lmdb_session=LMDBDao(
            genes_lmdb_path='',
            chemicals_lmdb_path='',
            compounds_lmdb_path='',
            proteins_lmdb_path='',
            species_lmdb_path='',
            diseases_lmdb_path='',
            phenotypes_lmdb_path='',
        ),
    )
    tree = create_tree(annotations=annotations, tree=AnnotationIntervalTree())
    fixed = tree.merge_overlaps(data_reducer=annotation_service.determine_entity_precedence)
    assert len(fixed) == 1
    assert fixed[0] == annotations[0]
