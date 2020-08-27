import attr
import json
import pytest

from os import path
from uuid import uuid4

from pdfminer.layout import LTChar

from neo4japp.database import (
    get_annotations_pdf_parser,
)
from neo4japp.data_transfer_objects import (
    Annotation,
    GeneAnnotation,
    PDFParsedCharacters,
    PDFTokenPositions,
    PDFTokenPositionsList,
)
from neo4japp.services.annotations.constants import EntityType, OrganismCategory


# reference to this directory
directory = path.realpath(path.dirname(__file__))


def get_dummy_LTChar(text):
    @attr.s(frozen=True)
    class Font():
        fontname: str = attr.ib()

        def is_vertical(self):
            return False

        def get_descent(self):
            return 0

    return LTChar(
        text=text,
        matrix=(0, 0, 0, 0, 0, 0),
        font=Font(fontname='font'),
        fontsize=0,
        scaling=0,
        rise=0,
        textwidth=0,
        textdisp=None,
        ncs=None,
        graphicstate=None,
    )


@pytest.mark.parametrize(
    'index, annotations',
    [
        (1, [
            Annotation(
                page_number=1,
                keyword='Test',
                lo_location_offset=5,
                hi_location_offset=8,
                keyword_length=4,
                text_in_document='Test',
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
                keyword='Test a long word',
                lo_location_offset=5,
                hi_location_offset=20,
                keyword_length=16,
                text_in_document='Test a long word',
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
        ]),
        (2, [
            Annotation(
                page_number=1,
                keyword='Test',
                lo_location_offset=5,
                hi_location_offset=8,
                keyword_length=4,
                text_in_document='test',
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
                keyword='Test',
                lo_location_offset=5,
                hi_location_offset=8,
                keyword_length=4,
                text_in_document='Test',
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
        ]),
        (3, [
            Annotation(
                page_number=1,
                keyword='Test',
                lo_location_offset=35,
                hi_location_offset=38,
                keyword_length=4,
                text_in_document='test',
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
                keyword='Test a long word',
                lo_location_offset=5,
                hi_location_offset=20,
                keyword_length=16,
                text_in_document='Test a long word',
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
        ]),
        (4, [
            Annotation(
                page_number=1,
                keyword='word',
                lo_location_offset=17,
                hi_location_offset=20,
                keyword_length=4,
                text_in_document='word',
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
                keyword='Test a long word',
                lo_location_offset=5,
                hi_location_offset=20,
                keyword_length=16,
                text_in_document='test a long word',
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
        ]),
        (5, [
            Annotation(
                page_number=1,
                keyword='word',
                lo_location_offset=17,
                hi_location_offset=20,
                keyword_length=4,
                text_in_document='word',
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
        ]),
        (6, [
            Annotation(
                page_number=1,
                keyword='word',
                lo_location_offset=17,
                hi_location_offset=20,
                keyword_length=4,
                text_in_document='word',
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
                keyword='Test a long word',
                lo_location_offset=5,
                hi_location_offset=20,
                keyword_length=16,
                text_in_document='test a long word',
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
                keyword='long word',
                lo_location_offset=55,
                hi_location_offset=63,
                keyword_length=16,
                text_in_document='long word',
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
        ]),
        # adjacent intervals
        (7, [
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
        ]),
        # adjacent intervals
        (8, [
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
        ]),
    ],
)
def test_fix_conflicting_annotations(
    get_annotations_service,
    index,
    annotations,
):
    annotation_service = get_annotations_service
    fixed = annotation_service.fix_conflicting_annotations(
        unified_annotations=annotations,
    )

    if index == 1:
        assert len(fixed) == 1
        # have to do asserts like this because the uuid will be different
        assert fixed[0].keyword == annotations[1].keyword
        assert fixed[0].lo_location_offset == annotations[1].lo_location_offset
        assert fixed[0].hi_location_offset == annotations[1].hi_location_offset
        assert fixed[0].meta.type == annotations[1].meta.type
    elif index == 2:
        assert len(fixed) == 1
        # have to do asserts like this because the uuid will be different
        assert fixed[0].keyword == annotations[0].keyword
        assert fixed[0].lo_location_offset == annotations[0].lo_location_offset
        assert fixed[0].hi_location_offset == annotations[0].hi_location_offset
        assert fixed[0].meta.type == annotations[0].meta.type
    elif index == 3:
        assert len(fixed) == 2
        matches = {f.keyword for f in fixed}
        assert annotations[0].keyword in matches
        assert annotations[1].keyword in matches
    elif index == 4:
        assert len(fixed) == 1
        # have to do asserts like this because the uuid will be different
        assert fixed[0].keyword == annotations[0].keyword
        assert fixed[0].lo_location_offset == annotations[0].lo_location_offset
        assert fixed[0].hi_location_offset == annotations[0].hi_location_offset
        assert fixed[0].meta.type == annotations[0].meta.type
    elif index == 5:
        assert len(fixed) == 1
        # have to do asserts like this because the uuid will be different
        assert fixed[0].keyword == annotations[0].keyword
        assert fixed[0].lo_location_offset == annotations[0].lo_location_offset
        assert fixed[0].hi_location_offset == annotations[0].hi_location_offset
        assert fixed[0].meta.type == annotations[0].meta.type
    elif index == 6:
        assert len(fixed) == 2
        matches = {f.keyword for f in fixed}
        assert annotations[0].keyword in matches
        assert annotations[1].keyword not in matches
        assert annotations[2].keyword in matches
    elif index == 7:
        # test adjacent intervals
        assert len(fixed) == 1
        # have to do asserts like this because the uuid will be different
        assert fixed[0].keyword == annotations[0].keyword
        assert fixed[0].lo_location_offset == annotations[0].lo_location_offset
        assert fixed[0].hi_location_offset == annotations[0].hi_location_offset
        assert fixed[0].meta.type == annotations[0].meta.type
    elif index == 8:
        # test adjacent intervals
        assert len(fixed) == 1
        # have to do asserts like this because the uuid will be different
        assert fixed[0].keyword == annotations[1].keyword
        assert fixed[0].lo_location_offset == annotations[1].lo_location_offset
        assert fixed[0].hi_location_offset == annotations[1].hi_location_offset
        assert fixed[0].meta.type == annotations[1].meta.type


def test_escherichia_coli_pdf(
    escherichia_coli_pdf_lmdb_setup,
    mock_get_gene_to_organism_match_result_for_escherichia_coli_pdf,
    get_annotations_service
):
    annotation_service = get_annotations_service
    pdf_parser = get_annotations_pdf_parser()

    pdf = path.join(directory, f'pdf_samples/ecoli_gene_test.pdf')

    with open(pdf, 'rb') as f:
        pdf_text = pdf_parser.parse_pdf(pdf=f)
        annotations = annotation_service.create_rules_based_annotations(
            tokens=pdf_parser.extract_tokens(parsed_chars=pdf_text),
            custom_annotations=[],
        )

    keywords = {o.keyword: o.meta.type for o in annotations}

    assert 'Escherichia coli' in keywords
    assert keywords['Escherichia coli'] == EntityType.Species.value

    assert 'purA' in keywords
    assert keywords['purA'] == EntityType.Gene.value

    assert 'purB' in keywords
    assert keywords['purB'] == EntityType.Gene.value

    assert 'purC' in keywords
    assert keywords['purC'] == EntityType.Gene.value

    assert 'purD' in keywords
    assert keywords['purD'] == EntityType.Gene.value

    assert 'purF' in keywords
    assert keywords['purF'] == EntityType.Gene.value


def test_custom_annotations_gene_organism_matching_has_match(
    default_lmdb_setup,
    mock_general_human_genes,
    get_annotations_service
):
    annotation_service = get_annotations_service
    pdf_parser = get_annotations_pdf_parser()

    pdf = path.join(directory, f'pdf_samples/custom_annotations_gene_matching.pdf')

    custom_annotation = {
        'meta': {
            'id': '9606',
            'type': 'Species',
            'color': '#3177b8',
            'links': {
                'ncbi': 'https://www.ncbi.nlm.nih.gov/gene/?query=hooman',
                'google': 'https://www.google.com/search?q=hooman',
                'uniprot': 'https://www.uniprot.org/uniprot/?sort=score&query=hooman',
                'wikipedia': 'https://www.google.com/search?q=site:+wikipedia.org+hooman',
            },
            'idType': '',
            'allText': 'hooman',
            'isCustom': True,
            'idHyperlink': '',
            'primaryLink': '',
            'includeGlobally': False,
        },
        'uuid': 'a66ec5d5-f65b-467d-b16e-b833161e07d1',
        'rects': [[76.8953975, 706.52786608, 119.3537674652, 718.27682008]],
        'user_id': 2,
        'keywords': ['hooman'],
        'pageNumber': 1,
        'inclusion_date': '2020-08-03 23:00:09.728591+00:00',
    }

    with open(pdf, 'rb') as f:
        pdf_text = pdf_parser.parse_pdf(pdf=f)
        annotations = annotation_service.create_rules_based_annotations(
            tokens=pdf_parser.extract_tokens(parsed_chars=pdf_text),
            custom_annotations=[custom_annotation],
        )

    assert len(annotations) == 1
    assert annotations[0].meta.id == '388962'  # human gene


def test_human_gene_pdf(
    human_gene_pdf_lmdb_setup,
    human_gene_pdf_gene_and_organism_network,
    mock_get_gene_to_organism_match_result_for_human_gene_pdf,
    get_annotations_service
):
    annotation_service = get_annotations_service
    pdf_parser = get_annotations_pdf_parser()

    pdf = path.join(directory, f'pdf_samples/human_gene_test.pdf')

    with open(pdf, 'rb') as f:
        pdf_text = pdf_parser.parse_pdf(pdf=f)
        annotations = annotation_service.create_rules_based_annotations(
            tokens=pdf_parser.extract_tokens(parsed_chars=pdf_text),
            custom_annotations=[],
        )

    keywords = {o.keyword: o.meta.type for o in annotations}

    assert 'COVID-19' in keywords
    assert keywords['COVID-19'] == EntityType.Disease.value

    assert 'MERS-CoV' in keywords
    assert keywords['MERS-CoV'] == EntityType.Species.value

    assert 'ACE2' in keywords
    assert keywords['ACE2'] == EntityType.Gene.value


@pytest.mark.parametrize(
    'tokens',
    [
        [
            PDFTokenPositions(
                page_number=1,
                keyword='hyp27',
                char_positions={0: 'h', 1: 'y', 2: 'p', 3: '2', 4: '7'},
            ),
            PDFTokenPositions(
                page_number=1,
                keyword='Moniliophthora roreri',
                char_positions={
                    6: 'M', 7: 'o', 8: 'n', 9: 'i', 10: 'l', 11: 'i',
                    12: 'o', 13: 'p', 14: 'h', 15: 't', 16: 'h', 17: 'o',
                    18: 'r', 19: 'a', 21: 'r', 22: 'o', 23: 'r', 24: 'e', 25: 'r', 26: 'i'},
            ),
            PDFTokenPositions(
                page_number=1,
                keyword='Hyp27',
                char_positions={28: 'H', 29: 'y', 30: 'p', 31: '2', 32: '7'},
            ),
            PDFTokenPositions(
                page_number=1,
                keyword='human',
                char_positions={34: 'h', 35: 'u', 36: 'm', 37: 'a', 38: 'n'},
            ),
        ]
    ],
)
def test_tokens_gene_vs_protein(
    default_lmdb_setup,
    mock_get_gene_to_organism_match_result,
    tokens,
    get_annotations_service
):
    annotation_service = get_annotations_service

    char_coord_objs_in_pdf = []
    for t in tokens:
        for c in t.keyword:
            char_coord_objs_in_pdf.append(get_dummy_LTChar(text=c))
        char_coord_objs_in_pdf.append(get_dummy_LTChar(text=' '))

    annotations = annotation_service.create_rules_based_annotations(
        tokens=PDFTokenPositionsList(
            token_positions=tokens,
            char_coord_objs_in_pdf=char_coord_objs_in_pdf,
            cropbox_in_pdf=(5, 5),
            min_idx_in_page=[1, 5, 10],
        ),
        custom_annotations=[],
    )

    assert len(annotations) == 4
    assert annotations[0].keyword == 'hyp27'
    assert annotations[0].meta.type == EntityType.Gene.value

    assert annotations[1].keyword == 'Moniliophthora roreri'
    assert annotations[1].meta.type == EntityType.Species.value

    assert annotations[2].keyword == 'Hyp27'
    assert annotations[2].meta.type == EntityType.Protein.value

    assert annotations[3].keyword == 'human'
    assert annotations[3].meta.type == EntityType.Species.value


@pytest.mark.parametrize(
    'index, tokens',
    [
        (1, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='Serpin A1',
                    char_positions={0: 'S', 1: 'e', 2: 'r', 3: 'p', 4: 'i', 5: 'n', 7: 'A', 8: '1'},
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='human',
                    char_positions={10: 'h', 11: 'u', 12: 'm', 13: 'a', 14: 'n'},
                ),
        ]),
        # overlapping intervals
        (2, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='SERPIN',
                    char_positions={0: 'S', 1: 'e', 2: 'r', 3: 'p', 4: 'i', 5: 'n', 6: 'A', 7: '1'},
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='SERPIN A1',
                    char_positions={0: 'S', 1: 'e', 2: 'r', 3: 'p', 4: 'i', 5: 'n', 7: 'A', 8: '1'},
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='human',
                    char_positions={10: 'h', 11: 'u', 12: 'm', 13: 'a', 14: 'n'},
                ),
        ]),
        (3, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='serpina1',
                    char_positions={0: 's', 1: 'e', 2: 'r', 3: 'p', 4: 'i', 5: 'n', 6: 'a', 7: '1'},
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='human',
                    char_positions={9: 'h', 10: 'u', 11: 'm', 12: 'a', 13: 'n'},
                ),
        ]),
        (4, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='SERPINA1',
                    char_positions={0: 'S', 1: 'E', 2: 'R', 3: 'P', 4: 'I', 5: 'N', 6: 'A', 7: '1'},
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='human',
                    char_positions={9: 'h', 10: 'u', 11: 'm', 12: 'a', 13: 'n'},
                ),
        ]),
        (5, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='SerpinA1',
                    char_positions={0: 'S', 1: 'e', 2: 'r', 3: 'p', 4: 'i', 5: 'n', 6: 'A', 7: '1'},
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='human',
                    char_positions={9: 'h', 10: 'u', 11: 'm', 12: 'a', 13: 'n'},
                ),
        ]),
    ],
)
def test_tokens_gene_vs_protein_serpina1_cases(
    default_lmdb_setup,
    mock_get_gene_to_organism_serpina1_match_result,
    index,
    tokens,
    get_annotations_service
):
    annotation_service = get_annotations_service

    char_coord_objs_in_pdf = []
    for t in tokens:
        for c in t.keyword:
            char_coord_objs_in_pdf.append(get_dummy_LTChar(text=c))
        char_coord_objs_in_pdf.append(get_dummy_LTChar(text=' '))

    annotations = annotation_service.create_rules_based_annotations(
        tokens=PDFTokenPositionsList(
            token_positions=tokens,
            char_coord_objs_in_pdf=char_coord_objs_in_pdf,
            cropbox_in_pdf=(5, 5),
            min_idx_in_page=[1, 5, 10],
        ),
        custom_annotations=[],
    )

    if index == 1 or index == 2 or index == 5:
        assert len(annotations) == 2
        assert annotations[0].keyword == 'Serpin A1'
        assert annotations[0].meta.type == EntityType.Protein.value

        assert annotations[1].keyword == 'human'
        assert annotations[1].meta.type == EntityType.Species.value
    elif index == 3:
        assert len(annotations) == 2
        assert annotations[0].keyword == 'serpina1'
        assert annotations[0].meta.type == EntityType.Gene.value

        assert annotations[1].keyword == 'human'
        assert annotations[1].meta.type == EntityType.Species.value
    elif index == 4:
        assert len(annotations) == 2
        assert annotations[0].keyword == 'SERPINA1'
        assert annotations[0].meta.type == EntityType.Gene.value

        assert annotations[1].keyword == 'human'
        assert annotations[1].meta.type == EntityType.Species.value


@pytest.mark.parametrize(
    'index, annotations',
    [
        (1, [
            GeneAnnotation(
                page_number=1,
                keyword='casE',
                lo_location_offset=5,
                hi_location_offset=8,
                keyword_length=4,
                text_in_document='case',
                keywords=[''],
                rects=[[1, 2]],
                meta=GeneAnnotation.GeneMeta(
                    type=EntityType.Gene.value,
                    color='',
                    id='',
                    id_type='',
                    id_hyperlink='',
                    links=Annotation.Meta.Links(),
                    category=OrganismCategory.Bacteria.value,
                ),
                uuid='',
            ),
        ]),
        (2, [
            GeneAnnotation(
                page_number=1,
                keyword='ADD',
                lo_location_offset=5,
                hi_location_offset=7,
                keyword_length=3,
                text_in_document='add',
                keywords=[''],
                rects=[[1, 2]],
                meta=GeneAnnotation.GeneMeta(
                    type=EntityType.Gene.value,
                    color='',
                    id='',
                    id_type='',
                    id_hyperlink='',
                    links=Annotation.Meta.Links(),
                    category=OrganismCategory.Eukaryota.value,
                ),
                uuid='',
            ),
        ]),
        (3, [
            GeneAnnotation(
                page_number=1,
                keyword='CpxR',
                lo_location_offset=5,
                hi_location_offset=7,
                keyword_length=3,
                text_in_document='CpxR',
                keywords=[''],
                rects=[[1, 2]],
                meta=GeneAnnotation.GeneMeta(
                    type=EntityType.Gene.value,
                    color='',
                    id='',
                    id_type='',
                    id_hyperlink='',
                    links=Annotation.Meta.Links(),
                    category=OrganismCategory.Bacteria.value,
                ),
                uuid='',
            ),
        ]),
    ],
)
def test_fix_false_positive_gene_annotations(get_annotations_service, index, annotations):
    annotation_service = get_annotations_service
    fixed = annotation_service._get_fixed_false_positive_unified_annotations(
        annotations_list=annotations,
    )

    # do exact case matching for genes
    if index == 1:
        assert len(fixed) == 0
    elif index == 2:
        assert len(fixed) == 0
    elif index == 3:
        assert len(fixed) == 1


@pytest.mark.parametrize(
    'index, annotations',
    [
        (1, [
            GeneAnnotation(
                page_number=1,
                keyword='IL7',
                lo_location_offset=5,
                hi_location_offset=8,
                keyword_length=4,
                text_in_document='IL-7',
                keywords=[''],
                rects=[[1, 2]],
                meta=GeneAnnotation.GeneMeta(
                    type=EntityType.Gene.value,
                    color='',
                    id='102353780',
                    id_type='',
                    id_hyperlink='',
                    links=Annotation.Meta.Links(),
                    category=OrganismCategory.Eukaryota.value,
                ),
                uuid='',
            ),
            Annotation(
                page_number=1,
                keyword='IL-7',
                lo_location_offset=5,
                hi_location_offset=8,
                keyword_length=4,
                text_in_document='IL-7',
                keywords=[''],
                rects=[[1, 2]],
                meta=Annotation.Meta(
                    type=EntityType.Protein.value,
                    color='',
                    id='12379999999',
                    id_type='',
                    id_hyperlink='',
                    links=Annotation.Meta.Links(),
                ),
                uuid='',
            ),
        ]),
        (2, [
            GeneAnnotation(
                page_number=1,
                keyword='IL7',
                lo_location_offset=5,
                hi_location_offset=8,
                keyword_length=4,
                text_in_document='il-7',
                keywords=[''],
                rects=[[1, 2]],
                meta=GeneAnnotation.GeneMeta(
                    type=EntityType.Gene.value,
                    color='',
                    id='10235378012123',
                    id_type='',
                    id_hyperlink='',
                    links=Annotation.Meta.Links(),
                    category=OrganismCategory.Eukaryota.value,
                ),
                uuid='',
            ),
            Annotation(
                page_number=1,
                keyword='IL-7',
                lo_location_offset=5,
                hi_location_offset=8,
                keyword_length=4,
                text_in_document='il-7',
                keywords=[''],
                rects=[[1, 2]],
                meta=Annotation.Meta(
                    type=EntityType.Protein.value,
                    color='',
                    id='12379999999',
                    id_type='',
                    id_hyperlink='',
                    links=Annotation.Meta.Links(),
                ),
                uuid='',
            ),
        ]),
    ],
)
def test_gene_vs_protein_annotations(
    get_annotations_service,
    index,
    annotations,
    fish_gene_lmdb_setup,
):
    annotation_service = get_annotations_service
    fixed = annotation_service.fix_conflicting_annotations(
        unified_annotations=annotations,
    )

    if index == 1:
        assert len(fixed) == 1
        # have to do asserts like this because the uuid will be different
        assert fixed[0].keyword == annotations[1].keyword
        assert fixed[0].lo_location_offset == annotations[1].lo_location_offset
        assert fixed[0].hi_location_offset == annotations[1].hi_location_offset
        assert fixed[0].meta.type == annotations[1].meta.type
    elif index == 2:
        assert len(fixed) == 1
        # have to do asserts like this because the uuid will be different
        assert fixed[0].keyword == annotations[0].keyword
        assert fixed[0].lo_location_offset == annotations[0].lo_location_offset
        assert fixed[0].hi_location_offset == annotations[0].hi_location_offset
        assert fixed[0].meta.type == annotations[0].meta.type


@pytest.mark.parametrize(
    'index, tokens',
    [
        (1, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='il-7',
                    char_positions={0: 'i', 1: 'l', 2: '-', 3: '7'},
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='coelacanth',
                    char_positions={
                        4: 'c', 5: 'o', 6: 'e', 7: 'l',
                        8: 'a', 9: 'c', 10: 'a', 11: 'n', 12: 't', 13: 'h',
                    },
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='Tetraodon rubripes',
                    char_positions={
                        14: 'T', 15: 'e', 16: 't', 17: 'r',
                        18: 'a', 19: 'o', 20: 'd', 21: 'o', 22: 'n', 24: 'r',
                        25: 'u', 26: 'b', 27: 'r', 28: 'i', 29: 'p', 30: 'e',
                        31: 's',
                    },
                ),
        ]),
    ],
)
def test_gene_annotation_uses_id_from_knowledge_graph(
    fish_gene_lmdb_setup,
    mock_get_gene_to_organism_match_result_for_fish_gene,
    index,
    tokens,
    get_annotations_service
):
    annotation_service = get_annotations_service

    char_coord_objs_in_pdf = []
    for t in tokens:
        for c in t.keyword:
            char_coord_objs_in_pdf.append(get_dummy_LTChar(text=c))
        char_coord_objs_in_pdf.append(get_dummy_LTChar(text=' '))

    annotations = annotation_service.create_rules_based_annotations(
        tokens=PDFTokenPositionsList(
            token_positions=tokens,
            char_coord_objs_in_pdf=char_coord_objs_in_pdf,
            cropbox_in_pdf=(5, 5),
            min_idx_in_page=[1, 5, 10],
        ),
        custom_annotations=[],
    )

    if index == 1:
        # id should change to match KG
        # value from mock_get_gene_to_organism_match_result_for_fish_gene
        assert annotations[0].meta.id == '99999'


@pytest.mark.parametrize(
    'index, tokens',
    [
        (1, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='rat',
                    char_positions={0: 'r', 1: 'a', 2: 't'},
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='EDEM3',
                    char_positions={4: 'E', 5: 'D', 6: 'E', 7: 'M', 8: '3'},
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='Human',
                    char_positions={10: 'H', 11: 'u', 12: 'm', 13: 'a', 14: 'n'},
                ),
        ]),
    ],
)
def test_gene_annotation_human_vs_rat(
    human_rat_gene_lmdb_setup,
    mock_get_gene_to_organism_match_result_for_human_rat_gene,
    index,
    tokens,
    get_annotations_service
):
    annotation_service = get_annotations_service

    char_coord_objs_in_pdf = []
    for t in tokens:
        for c in t.keyword:
            char_coord_objs_in_pdf.append(get_dummy_LTChar(text=c))
        char_coord_objs_in_pdf.append(get_dummy_LTChar(text=' '))

    annotations = annotation_service.create_rules_based_annotations(
        tokens=PDFTokenPositionsList(
            token_positions=tokens,
            char_coord_objs_in_pdf=char_coord_objs_in_pdf,
            cropbox_in_pdf=(5, 5),
            min_idx_in_page=[1, 5, 10],
        ),
        custom_annotations=[],
    )

    if index == 1:
        for a in annotations:
            if a.text_in_document == 'EDEM3':
                # id should change to match KG
                # value from mock_get_gene_to_organism_match_result_for_human_rat_gene
                assert annotations[1].meta.id == '80267'


@pytest.mark.parametrize(
    'index, tokens',
    [
        (1, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='human',
                    char_positions={0: 'h', 1: 'u', 2: 'm', 3: 'a', 4: 'n'},
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='FO(-)',
                    char_positions={6: 'F', 7: 'O', 8: '(', 9: '-', 10: ')'},
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='H',
                    char_positions={12: 'H'},
                ),
        ]),
    ],
)
def test_ignore_terms_length_two_or_less(
    default_lmdb_setup,
    mock_empty_gene_to_organism,
    index,
    tokens,
    get_annotations_service
):
    annotation_service = get_annotations_service

    char_coord_objs_in_pdf = []
    for t in tokens:
        for c in t.keyword:
            char_coord_objs_in_pdf.append(get_dummy_LTChar(text=c))
        char_coord_objs_in_pdf.append(get_dummy_LTChar(text=' '))

    annotations = annotation_service.create_rules_based_annotations(
        tokens=PDFTokenPositionsList(
            token_positions=tokens,
            char_coord_objs_in_pdf=char_coord_objs_in_pdf,
            cropbox_in_pdf=(5, 5),
            min_idx_in_page=[1, 5, 10],
        ),
        custom_annotations=[],
    )

    assert len(annotations) == 1
    assert annotations[0].keyword == tokens[0].keyword


@pytest.mark.parametrize(
    'index, tokens',
    [
        (1, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='hypofluorite',
                    char_positions={
                        0: 'a', 1: 'y', 2: 'p', 3: 'o', 4: 'f',
                        5: 'l', 6: 'u', 7: 'o', 8: 'r', 9: 'i',
                        10: 't', 11: 'e'},
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='rat',
                    char_positions={12: 'r', 13: 'a', 14: 't'},
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='dog',
                    char_positions={16: 'd', 17: 'o', 18: 'g'},
                ),
        ]),
    ],
)
def test_global_excluded_chemical_annotations(
    default_lmdb_setup,
    mock_global_chemical_exclusion,
    index,
    tokens,
    get_annotations_service
):
    annotation_service = get_annotations_service

    char_coord_objs_in_pdf = []
    for t in tokens:
        for c in t.keyword:
            char_coord_objs_in_pdf.append(get_dummy_LTChar(text=c))
        char_coord_objs_in_pdf.append(get_dummy_LTChar(text=' '))

    annotations = annotation_service.create_rules_based_annotations(
        tokens=PDFTokenPositionsList(
            token_positions=tokens,
            char_coord_objs_in_pdf=char_coord_objs_in_pdf,
            cropbox_in_pdf=(5, 5),
            min_idx_in_page=[1, 5, 10],
        ),
        custom_annotations=[],
    )

    assert len(annotations) == 1
    assert tokens[0].keyword not in set([anno.keyword for anno in annotations])


@pytest.mark.parametrize(
    'index, tokens',
    [
        (1, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='guanosine',
                    char_positions={
                        0: 'g', 1: 'u', 2: 'a', 3: 'n', 4: 'o',
                        5: 's', 6: 'i', 7: 'n', 8: 'e'},
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='rat',
                    char_positions={10: 'r', 11: 'a', 12: 't'},
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='dog',
                    char_positions={14: 'd', 15: 'o', 16: 'g'},
                ),
        ]),
    ],
)
def test_global_excluded_compound_annotations(
    default_lmdb_setup,
    mock_global_compound_exclusion,
    index,
    tokens,
    get_annotations_service
):
    annotation_service = get_annotations_service

    char_coord_objs_in_pdf = []
    for t in tokens:
        for c in t.keyword:
            char_coord_objs_in_pdf.append(get_dummy_LTChar(text=c))
        char_coord_objs_in_pdf.append(get_dummy_LTChar(text=' '))

    annotations = annotation_service.create_rules_based_annotations(
        tokens=PDFTokenPositionsList(
            token_positions=tokens,
            char_coord_objs_in_pdf=char_coord_objs_in_pdf,
            cropbox_in_pdf=(5, 5),
            min_idx_in_page=[1, 5, 10],
        ),
        custom_annotations=[],
    )

    assert len(annotations) == 1
    assert tokens[0].keyword not in set([anno.keyword for anno in annotations])


@pytest.mark.parametrize(
    'index, tokens',
    [
        (1, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='adenosine',
                    char_positions={
                        0: 'a', 1: 'd', 2: 'e', 3: 'n', 4: 'o',
                        5: 's', 6: 'i', 7: 'n', 8: 'e'},
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='rat',
                    char_positions={10: 'r', 11: 'a', 12: 't'},
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='cold sore',
                    char_positions={
                        14: 'c', 15: 'o', 16: 'l', 17: 'd',
                        19: 's', 20: 'o', 21: 'r', 22: 'e'},
                ),
        ]),
    ],
)
def test_global_excluded_disease_annotations(
    default_lmdb_setup,
    mock_global_disease_exclusion,
    index,
    tokens,
    get_annotations_service
):
    annotation_service = get_annotations_service

    char_coord_objs_in_pdf = []
    for t in tokens:
        for c in t.keyword:
            char_coord_objs_in_pdf.append(get_dummy_LTChar(text=c))
        char_coord_objs_in_pdf.append(get_dummy_LTChar(text=' '))

    annotations = annotation_service.create_rules_based_annotations(
        tokens=PDFTokenPositionsList(
            token_positions=tokens,
            char_coord_objs_in_pdf=char_coord_objs_in_pdf,
            cropbox_in_pdf=(5, 5),
            min_idx_in_page=[1, 5, 10],
        ),
        custom_annotations=[],
    )

    assert len(annotations) == 2
    assert tokens[2].keyword not in set([anno.keyword for anno in annotations])


@pytest.mark.parametrize(
    'index, tokens',
    [
        (1, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='adenosine',
                    char_positions={
                        0: 'a', 1: 'd', 2: 'e', 3: 'n', 4: 'o',
                        5: 's', 6: 'i', 7: 'n', 8: 'e'},
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='rat',
                    char_positions={10: 'r', 11: 'a', 12: 't'},
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='BOLA3',
                    char_positions={
                        14: 'B', 15: 'O', 16: 'L', 17: 'A', 19: '3'},
                ),
        ]),
    ],
)
def test_global_excluded_gene_annotations(
    default_lmdb_setup,
    mock_global_gene_exclusion,
    index,
    tokens,
    get_annotations_service
):
    annotation_service = get_annotations_service

    char_coord_objs_in_pdf = []
    for t in tokens:
        for c in t.keyword:
            char_coord_objs_in_pdf.append(get_dummy_LTChar(text=c))
        char_coord_objs_in_pdf.append(get_dummy_LTChar(text=' '))

    annotations = annotation_service.create_rules_based_annotations(
        tokens=PDFTokenPositionsList(
            token_positions=tokens,
            char_coord_objs_in_pdf=char_coord_objs_in_pdf,
            cropbox_in_pdf=(5, 5),
            min_idx_in_page=[1, 5, 10],
        ),
        custom_annotations=[],
    )

    assert len(annotations) == 2
    assert tokens[2].keyword not in set([anno.keyword for anno in annotations])


@pytest.mark.parametrize(
    'index, tokens',
    [
        (1, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='adenosine',
                    char_positions={
                        0: 'a', 1: 'd', 2: 'e', 3: 'n', 4: 'o',
                        5: 's', 6: 'i', 7: 'n', 8: 'e'},
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='rat',
                    char_positions={10: 'r', 11: 'a', 12: 't'},
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='Whey Proteins',
                    char_positions={
                        14: 'W', 15: 'h', 16: 'e', 17: 'y',
                        19: 'P', 20: 'r', 21: 'o', 22: 't', 23: 'e', 24: 'i', 25: 'n', 26: 's'},
                ),
        ]),
    ],
)
def test_global_excluded_phenotype_annotations(
    default_lmdb_setup,
    mock_global_phenotype_exclusion,
    index,
    tokens,
    get_annotations_service
):
    annotation_service = get_annotations_service

    char_coord_objs_in_pdf = []
    for t in tokens:
        for c in t.keyword:
            char_coord_objs_in_pdf.append(get_dummy_LTChar(text=c))
        char_coord_objs_in_pdf.append(get_dummy_LTChar(text=' '))

    annotations = annotation_service.create_rules_based_annotations(
        tokens=PDFTokenPositionsList(
            token_positions=tokens,
            char_coord_objs_in_pdf=char_coord_objs_in_pdf,
            cropbox_in_pdf=(5, 5),
            min_idx_in_page=[1, 5, 10],
        ),
        custom_annotations=[],
    )

    assert len(annotations) == 2
    assert tokens[2].keyword not in set([anno.keyword for anno in annotations])


@pytest.mark.parametrize(
    'index, tokens',
    [
        (1, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='adenosine',
                    char_positions={
                        0: 'a', 1: 'd', 2: 'e', 3: 'n', 4: 'o',
                        5: 's', 6: 'i', 7: 'n', 8: 'e'},
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='rat',
                    char_positions={10: 'r', 11: 'a', 12: 't'},
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='Wasabi receptor toxin',
                    char_positions={
                        14: 'W', 15: 'a', 16: 's', 17: 'a', 18: 'b', 19: 'i',
                        21: 'r', 22: 'e', 23: 'c', 24: 'e', 25: 'p', 26: 't', 27: 'o', 28: 'r',
                        30: 't', 31: 'o', 32: 'x', 33: 'i', 34: 'n'},
                ),
        ]),
    ],
)
def test_global_excluded_protein_annotations(
    default_lmdb_setup,
    mock_global_protein_exclusion,
    index,
    tokens,
    get_annotations_service
):
    annotation_service = get_annotations_service

    char_coord_objs_in_pdf = []
    for t in tokens:
        for c in t.keyword:
            char_coord_objs_in_pdf.append(get_dummy_LTChar(text=c))
        char_coord_objs_in_pdf.append(get_dummy_LTChar(text=' '))

    annotations = annotation_service.create_rules_based_annotations(
        tokens=PDFTokenPositionsList(
            token_positions=tokens,
            char_coord_objs_in_pdf=char_coord_objs_in_pdf,
            cropbox_in_pdf=(5, 5),
            min_idx_in_page=[1, 5, 10],
        ),
        custom_annotations=[],
    )

    assert len(annotations) == 2
    assert tokens[2].keyword not in set([anno.keyword for anno in annotations])


@pytest.mark.parametrize(
    'index, tokens',
    [
        (1, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='human',
                    char_positions={0: 'h', 1: 'u', 2: 'm', 3: 'a', 4: 'n'},
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='rat',
                    char_positions={6: 'r', 7: 'a', 8: 't'},
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='dog',
                    char_positions={9: 'd', 10: 'o', 11: 'g'},
                ),
        ]),
    ],
)
def test_global_excluded_species_annotations(
    default_lmdb_setup,
    mock_global_species_exclusion,
    index,
    tokens,
    get_annotations_service
):
    annotation_service = get_annotations_service

    char_coord_objs_in_pdf = []
    for t in tokens:
        for c in t.keyword:
            char_coord_objs_in_pdf.append(get_dummy_LTChar(text=c))
        char_coord_objs_in_pdf.append(get_dummy_LTChar(text=' '))

    annotations = annotation_service.create_rules_based_annotations(
        tokens=PDFTokenPositionsList(
            token_positions=tokens,
            char_coord_objs_in_pdf=char_coord_objs_in_pdf,
            cropbox_in_pdf=(5, 5),
            min_idx_in_page=[1, 5, 10],
        ),
        custom_annotations=[],
    )

    # dog is not in default_lmdb_setup
    assert len(annotations) == 1
    assert annotations[0].keyword == tokens[1].keyword


@pytest.mark.parametrize(
    'index, tokens',
    [
        (1, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='adenosine',
                    char_positions={
                        0: 'a', 1: 'd', 2: 'e', 3: 'n', 4: 'o',
                        5: 's', 6: 'i', 7: 'n', 8: 'e'},
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='rat',
                    char_positions={10: 'r', 11: 'a', 12: 't'},
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='dog',
                    char_positions={14: 'd', 15: 'o', 16: 'g'},
                ),
        ]),
    ],
)
def test_global_excluded_annotations_does_not_interfere_with_other_entities(
    default_lmdb_setup,
    mock_global_chemical_exclusion,
    index,
    tokens,
    get_annotations_service
):
    annotation_service = get_annotations_service

    char_coord_objs_in_pdf = []
    for t in tokens:
        for c in t.keyword:
            char_coord_objs_in_pdf.append(get_dummy_LTChar(text=c))
        char_coord_objs_in_pdf.append(get_dummy_LTChar(text=' '))

    annotations = annotation_service.create_rules_based_annotations(
        tokens=PDFTokenPositionsList(
            token_positions=tokens,
            char_coord_objs_in_pdf=char_coord_objs_in_pdf,
            cropbox_in_pdf=(5, 5),
            min_idx_in_page=[1, 5, 10],
        ),
        custom_annotations=[],
    )

    assert len(annotations) == 2
    assert tokens[2].keyword not in set([anno.keyword for anno in annotations])
    assert annotations[0].keyword == 'adenosine'
    assert annotations[0].meta.type == EntityType.Compound.value


@pytest.mark.parametrize(
    'index, tokens',
    [
        (1, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='NS2A',
                    char_positions={0: 'N', 1: 'S', 2: '2', 3: 'A'},
                ),
        ]),
    ],
)
def test_lmdb_match_protein_by_exact_case_if_multiple_matches(
    default_lmdb_setup,
    index,
    tokens,
    get_annotations_service
):
    annotation_service = get_annotations_service

    char_coord_objs_in_pdf = []
    for t in tokens:
        for c in t.keyword:
            char_coord_objs_in_pdf.append(get_dummy_LTChar(text=c))
        char_coord_objs_in_pdf.append(get_dummy_LTChar(text=' '))

    annotations = annotation_service.create_rules_based_annotations(
        tokens=PDFTokenPositionsList(
            token_positions=tokens,
            char_coord_objs_in_pdf=char_coord_objs_in_pdf,
            cropbox_in_pdf=(5, 5),
            min_idx_in_page=[1, 5, 10],
        ),
        custom_annotations=[],
    )

    assert len(annotations) == 1
    # both ns2a and NS2A are in LMDB
    assert annotations[0].keyword == 'NS2A'
