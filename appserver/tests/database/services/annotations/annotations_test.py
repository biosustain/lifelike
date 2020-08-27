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
                char_positions={
                    i: c for i, c in enumerate('hyp27') if c != ' '}
            ),
            PDFTokenPositions(
                page_number=1,
                keyword='Moniliophthora roreri',
                char_positions={
                    i + len('hyp27') + 2: c for i, c in enumerate('Moniliophthora roreri') if c != ' '}  # noqa
            ),
            PDFTokenPositions(
                page_number=1,
                keyword='Hyp27',
                char_positions={
                    i + len('hyp27') + len('Moniliophthora roreri') + 2: c for i, c in enumerate('Hyp27') if c != ' '}  # noqa
            ),
            PDFTokenPositions(
                page_number=1,
                keyword='human',
                char_positions={
                    i + len('hyp27') + len('Moniliophthora roreri') + len('Hyp27') + 2: c for i, c in enumerate('human') if c != ' '}  # noqa
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
                    char_positions={
                        i: c for i, c in enumerate('Serpin A1') if c != ' '
                    }
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='human',
                    char_positions={
                        i + len('Serpin A1'): c for i, c in enumerate('human') if c != ' '
                    }
                ),
        ]),
        # overlapping intervals
        (2, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='SERPIN',
                    char_positions={
                        i: c for i, c in enumerate('SERPIN') if c != ' '
                    }
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='SERPIN A1',
                    char_positions={
                        i + len('SERPIN') + 2: c for i, c in enumerate('SERPINA A1') if c != ' '}  # noqa
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='human',
                    char_positions={
                        i + len('SERPIN') + len('SERPINA A1') + 2: c for i, c in enumerate('human') if c != ' '}  # noqa
                ),
        ]),
        (3, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='serpina1',
                    char_positions={
                        i: c for i, c in enumerate('serpina1') if c != ' '
                    }
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='human',
                    char_positions={
                        i + len('serpina1') + 2: c for i, c in enumerate('human') if c != ' '
                    }
                ),
        ]),
        (4, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='SERPINA1',
                    char_positions={
                        i: c for i, c in enumerate('SERPINA1') if c != ' '
                    }
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='human',
                    char_positions={
                        i + len('SERPINA1') + 2: c for i, c in enumerate('human') if c != ' '
                    }
                ),
        ]),
        (5, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='SerpinA1',
                    char_positions={
                        i: c for i, c in enumerate('SerpinA1') if c != ' '
                    }
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='human',
                    char_positions={
                        i + len('SerpinA1') + 2: c for i, c in enumerate('human') if c != ' '
                    }
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
                    char_positions={
                        i: c for i, c in enumerate('il-7') if c != ' '
                    }
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='coelacanth',
                    char_positions={
                        i + len('il-7') + 2: c for i, c in enumerate('coelacanth') if c != ' '}  # noqa
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='Tetraodon rubripes',
                    char_positions={
                        i + len('il-7') + len('coelacanth') + 2: c for i, c in enumerate('Tetraodon rubripes') if c != ' '}  # noqa
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
                    char_positions={
                        i: c for i, c in enumerate('rat') if c != ' '
                    }
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='EDEM3',
                    char_positions={
                        i + len('rat') + 2: c for i, c in enumerate('EDEM3') if c != ' '}
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='Human',
                    char_positions={
                        i + len('rat') + len('EDEM3') + 2: c for i, c in enumerate('Human') if c != ' '}  # noqa
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
                    char_positions={
                        i: c for i, c in enumerate('human') if c != ' '
                    }
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='FO(-)',
                    char_positions={
                        i + len('human') + 2: c for i, c in enumerate('FO(-)') if c != ' '}  # noqa
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='H',
                    char_positions={
                        i + len('human') + len('FO(-)') + 2: c for i, c in enumerate('H') if c != ' '}  # noqa
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
                        i: c for i, c in enumerate('hypofluorite') if c != ' '
                    }
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='rat',
                    char_positions={
                        i + len('hypofluorite') + 2: c for i, c in enumerate('rat') if c != ' '}  # noqa
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='dog',
                    char_positions={
                        i + len('hypofluorite') + len('rat') + 2: c for i, c in enumerate('dog') if c != ' '}  # noqa
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
                        i: c for i, c in enumerate('guanosine') if c != ' '
                    }
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='rat',
                    char_positions={
                        i + len('guanosine') + 2: c for i, c in enumerate('rat') if c != ' '}  # noqa
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='dog',
                    char_positions={
                        i + len('guanosine') + len('rat') + 2: c for i, c in enumerate('dog') if c != ' '}  # noqa
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
                        i: c for i, c in enumerate('adenosine') if c != ' '
                    }
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='rat',
                    char_positions={
                        i + len('adenosine') + 2: c for i, c in enumerate('rat') if c != ' '}  # noqa
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='cold sore',
                    char_positions={
                        i + len('adenosine') + len('rat') + 2: c for i, c in enumerate('cold sore') if c != ' '}  # noqa
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
                        i: c for i, c in enumerate('adenosine') if c != ' '
                    }
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='rat',
                    char_positions={
                        i + len('adenosine') + 2: c for i, c in enumerate('rat') if c != ' '}  # noqa
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='BOLA3',
                    char_positions={
                        i + len('adenosine') + len('rat') + 2: c for i, c in enumerate('BOLA3') if c != ' '}  # noqa
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
                        i: c for i, c in enumerate('adenosine') if c != ' '
                    }
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='rat',
                    char_positions={
                        i + len('adenosine') + 2: c for i, c in enumerate('rat') if c != ' '}  # noqa
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='Whey Proteins',
                    char_positions={
                        i + len('adenosine') + len('rat') + 2: c for i, c in enumerate('Whey Proteins') if c != ' '}  # noqa
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
                        i: c for i, c in enumerate('adenosine') if c != ' '
                    }
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='rat',
                    char_positions={
                        i + len('adenosine') + 2: c for i, c in enumerate('rat') if c != ' '}  # noqa
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='Wasabi receptor toxin',
                    char_positions={
                        i + len('adenosine') + len('rat') + 2: c for i, c in enumerate('Wasabi receptor toxin') if c != ' '}  # noqa
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
                    char_positions={
                        i: c for i, c in enumerate('human') if c != ' '
                    }
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='rat',
                    char_positions={
                        i + len('human') + 2: c for i, c in enumerate('rat') if c != ' '}  # noqa
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='dog',
                    char_positions={
                        i + len('human') + len('rat') + 2: c for i, c in enumerate('dog') if c != ' '}  # noqa
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
                        i: c for i, c in enumerate('adenosine') if c != ' '
                    }
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='rat',
                    char_positions={
                        i + len('adenosine') + 2: c for i, c in enumerate('rat') if c != ' '}  # noqa
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='dog',
                    char_positions={
                        i + len('adenosine') + len('rat') + 2: c for i, c in enumerate('dog') if c != ' '}  # noqa
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
                    char_positions={
                        i: c for i, c in enumerate('NS2A') if c != ' '
                    }
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


@pytest.mark.parametrize(
    'index, tokens',
    [
        (1, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='fake-chemical-(12345)',
                    char_positions={
                        i: c for i, c in enumerate('fake-chemical-(12345)') if c != ' '
                    }
                ),
        ]),
    ],
)
def test_global_chemical_inclusion_annotation(
    default_lmdb_setup,
    mock_global_chemical_inclusion,
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
    assert annotations[0].keyword == 'fake-chemical-(12345)'
    assert annotations[0].meta.id == 'CHEBI:Fake'


@pytest.mark.parametrize(
    'index, tokens',
    [
        (1, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='compound-(12345)',
                    char_positions={
                        i: c for i, c in enumerate('compound-(12345)') if c != ' '
                    }
                ),
        ]),
    ],
)
def test_global_compound_inclusion_annotation(
    default_lmdb_setup,
    mock_global_compound_inclusion,
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
    assert annotations[0].keyword == 'compound-(12345)'
    assert annotations[0].meta.id == 'BIOC:Fake'


@pytest.mark.parametrize(
    'index, tokens',
    [
        (1, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='gene-(12345)',
                    char_positions={
                        i: c for i, c in enumerate('gene-(12345)') if c != ' '
                    }
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='human',
                    char_positions={
                        i + len('gene-(12345)') + 2: c for i, c in enumerate('human') if c != ' '
                    }
                ),
        ]),
    ],
)
def test_global_gene_inclusion_annotation(
    default_lmdb_setup,
    human_gene_pdf_lmdb_setup,
    mock_global_gene_inclusion,
    mock_get_gene_ace2_for_global_gene_inclusion,
    mock_get_gene_to_organism_match_result_for_human_gene_pdf,
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
    # new gene should be considered a synonym of
    # main gene with 59272 id (e.g ACE2)
    assert annotations[0].keyword == 'gene-(12345)'
    assert annotations[0].meta.id == '59272'


@pytest.mark.parametrize(
    'index, tokens',
    [
        (1, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='disease-(12345)',
                    char_positions={
                        i: c for i, c in enumerate('disease-(12345)') if c != ' '
                    }
                ),
        ]),
    ],
)
def test_global_disease_inclusion_annotation(
    default_lmdb_setup,
    mock_global_disease_inclusion,
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
    assert annotations[0].keyword == 'disease-(12345)'
    assert annotations[0].meta.id == 'Ncbi:Fake'


@pytest.mark.parametrize(
    'index, tokens',
    [
        (1, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='phenotype-(12345)',
                    char_positions={
                        i: c for i, c in enumerate('phenotype-(12345)') if c != ' '
                    }
                ),
        ]),
    ],
)
def test_global_phenotype_inclusion_annotation(
    default_lmdb_setup,
    mock_global_phenotype_inclusion,
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
    assert annotations[0].keyword == 'phenotype-(12345)'
    assert annotations[0].meta.id == 'Ncbi:Fake'


@pytest.mark.parametrize(
    'index, tokens',
    [
        (1, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='protein-(12345)',
                    char_positions={
                        i: c for i, c in enumerate('protein-(12345)') if c != ' '
                    }
                ),
        ]),
    ],
)
def test_global_protein_inclusion_annotation(
    default_lmdb_setup,
    mock_global_protein_inclusion,
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
    assert annotations[0].keyword == 'protein-(12345)'
    assert annotations[0].meta.id == 'protein-(12345)'


@pytest.mark.parametrize(
    'index, tokens',
    [
        (1, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='species-(12345)',
                    char_positions={
                        i: c for i, c in enumerate('species-(12345)') if c != ' '
                    }
                ),
        ]),
    ],
)
def test_global_species_inclusion_annotation(
    default_lmdb_setup,
    mock_global_species_inclusion,
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
    assert annotations[0].keyword == 'species-(12345)'
    assert annotations[0].meta.id == 'Ncbi:Fake'
