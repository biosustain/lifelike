import pytest

from uuid import uuid4

from neo4japp.data_transfer_objects import Annotation
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
                text_in_document='word a',
                keywords=[''],
                rects=[[1, 2]],
                meta=Annotation.Meta(
                    type=EntityType.Chemical.value,
                    color='',
                    id='',
                    id_type='',
                    id_hyperlink='',
                    links=Annotation.Meta.Links(),
                ),
                uuid='',
            ),
            Annotation(
                page_number=1,
                keyword='a long word',
                lo_location_offset=22,
                hi_location_offset=32,
                keyword_length=10,
                text_in_document='a long word',
                keywords=[''],
                rects=[[1, 2]],
                meta=Annotation.Meta(
                    type=EntityType.Chemical.value,
                    color='',
                    id='',
                    id_type='',
                    id_hyperlink='',
                    links=Annotation.Meta.Links(),
                ),
                uuid='',
            ),
        ],
    ],
)
def test_merge_adjacent_intervals_with_same_type(get_annotations_service, annotations):
    annotation_service = get_annotations_service

    tree = create_tree(annotations=annotations, tree=AnnotationIntervalTree())
    fixed = tree.merge_overlaps(
        data_reducer=annotation_service.determine_entity_precedence,
    )
    assert len(fixed) == 1
    # have to do asserts like this because the uuid will be different
    assert fixed[0].keyword == annotations[1].keyword
    assert fixed[0].lo_location_offset == annotations[1].lo_location_offset
    assert fixed[0].hi_location_offset == annotations[1].hi_location_offset
    assert fixed[0].meta.type == annotations[1].meta.type


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
                text_in_document='word a',
                keywords=[''],
                rects=[[1, 2]],
                meta=Annotation.Meta(
                    type=EntityType.Chemical.value,
                    color='',
                    id='',
                    id_type='',
                    id_hyperlink='',
                    links=Annotation.Meta.Links(),
                ),
                uuid='',
            ),
            Annotation(
                page_number=1,
                keyword='a long word',
                lo_location_offset=22,
                hi_location_offset=32,
                keyword_length=10,
                text_in_document='a long word',
                keywords=[''],
                rects=[[1, 2]],
                meta=Annotation.Meta(
                    type=EntityType.Protein.value,
                    color='',
                    id='',
                    id_type='',
                    id_hyperlink='',
                    links=Annotation.Meta.Links(),
                ),
                uuid='',
            ),
        ],
    ],
)
def test_merge_adjacent_intervals_with_different_type(get_annotations_service, annotations):
    annotation_service = get_annotations_service

    tree = create_tree(annotations=annotations, tree=AnnotationIntervalTree())
    fixed = tree.merge_overlaps(
        data_reducer=annotation_service.determine_entity_precedence,
    )
    assert len(fixed) == 1
    # have to do asserts like this because the uuid will be different
    assert fixed[0].keyword == annotations[1].keyword
    assert fixed[0].lo_location_offset == annotations[1].lo_location_offset
    assert fixed[0].hi_location_offset == annotations[1].hi_location_offset
    assert fixed[0].meta.type == annotations[1].meta.type


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
                text_in_document='word a',
                keywords=[''],
                rects=[[1, 2]],
                meta=Annotation.Meta(
                    type=EntityType.Chemical.value,
                    color='',
                    id='',
                    id_type='',
                    id_hyperlink='',
                    links=Annotation.Meta.Links(),
                ),
                uuid='',
            ),
            Annotation(
                page_number=1,
                keyword='word a',
                lo_location_offset=17,
                hi_location_offset=22,
                keyword_length=6,
                text_in_document='word a',
                keywords=[''],
                rects=[[1, 2]],
                meta=Annotation.Meta(
                    type=EntityType.Chemical.value,
                    color='',
                    id='',
                    id_type='',
                    id_hyperlink='',
                    links=Annotation.Meta.Links(),
                ),
                uuid='',
            ),
        ],
    ],
)
def test_merge_equal_intervals_with_same_type(get_annotations_service, annotations):
    annotation_service = get_annotations_service

    tree = create_tree(annotations=annotations, tree=AnnotationIntervalTree())
    fixed = tree.merge_overlaps(
        data_reducer=annotation_service.determine_entity_precedence,
    )
    assert len(fixed) == 1
    # have to do asserts like this because the uuid will be different
    assert fixed[0].keyword == annotations[1].keyword
    assert fixed[0].lo_location_offset == annotations[1].lo_location_offset
    assert fixed[0].hi_location_offset == annotations[1].hi_location_offset
    assert fixed[0].meta.type == annotations[1].meta.type


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
                text_in_document='word a',
                keywords=[''],
                rects=[[1, 2]],
                meta=Annotation.Meta(
                    type=EntityType.Gene.value,
                    color='',
                    id='',
                    id_type='',
                    id_hyperlink='',
                    links=Annotation.Meta.Links(),
                ),
                uuid='',
            ),
            Annotation(
                page_number=1,
                keyword='word a',
                lo_location_offset=17,
                hi_location_offset=22,
                keyword_length=6,
                text_in_document='word a',
                keywords=[''],
                rects=[[1, 2]],
                meta=Annotation.Meta(
                    type=EntityType.Chemical.value,
                    color='',
                    id='',
                    id_type='',
                    id_hyperlink='',
                    links=Annotation.Meta.Links(),
                ),
                uuid='',
            ),
        ],
    ],
)
def test_merge_equal_intervals_with_different_type(get_annotations_service, annotations):
    annotation_service = get_annotations_service

    tree = create_tree(annotations=annotations, tree=AnnotationIntervalTree())
    fixed = tree.merge_overlaps(
        data_reducer=annotation_service.determine_entity_precedence,
    )
    assert len(fixed) == 1
    # have to do asserts like this because the uuid will be different
    assert fixed[0].keyword == annotations[0].keyword
    assert fixed[0].lo_location_offset == annotations[0].lo_location_offset
    assert fixed[0].hi_location_offset == annotations[0].hi_location_offset
    assert fixed[0].meta.type == annotations[0].meta.type
