import attr
import json
import pytest

from os import path

from pdfminer.layout import LTChar

from neo4japp.database import (
    get_annotations_service,
    get_bioc_document_service,
    get_annotations_pdf_parser,
    get_lmdb_dao,
)
from neo4japp.data_transfer_objects import (
    Annotation,
    GeneAnnotation,
    PDFParsedCharacters,
    PDFTokenPositions,
    PDFTokenPositionsList,
)
from neo4japp.models import Files, FileContent
from neo4japp.services.annotations import AnnotationsService, LMDBDao
from neo4japp.services.annotations.constants import EntityType, OrganismCategory


# reference to this directory
directory = path.realpath(path.dirname(__file__))


def get_test_annotations_service(
    genes_lmdb_path='',
    chemicals_lmdb_path='',
    compounds_lmdb_path='',
    proteins_lmdb_path='',
    species_lmdb_path='',
    diseases_lmdb_path='',
    phenotypes_lmdb_path='',
):
    return AnnotationsService(
        lmdb_session=LMDBDao(
            genes_lmdb_path=genes_lmdb_path,
            chemicals_lmdb_path=chemicals_lmdb_path,
            compounds_lmdb_path=compounds_lmdb_path,
            proteins_lmdb_path=proteins_lmdb_path,
            species_lmdb_path=species_lmdb_path,
            diseases_lmdb_path=diseases_lmdb_path,
            phenotypes_lmdb_path=phenotypes_lmdb_path,
        ),
    )


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
                keyword='Test a long word',
                lo_location_offset=5,
                hi_location_offset=20,
                keyword_length=16,
                text_in_document='Test a long word',
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
                keyword='Test',
                lo_location_offset=5,
                hi_location_offset=8,
                keyword_length=4,
                text_in_document='Test',
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
                keyword='Test a long word',
                lo_location_offset=5,
                hi_location_offset=20,
                keyword_length=16,
                text_in_document='Test a long word',
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
                keyword='Test a long word',
                lo_location_offset=5,
                hi_location_offset=20,
                keyword_length=16,
                text_in_document='test a long word',
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
                    keyword_type=EntityType.Gene.value,
                    color='',
                    id='',
                    id_type='',
                    id_hyperlink='',
                    links=Annotation.Meta.Links(),
                ),
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
                keyword='Test a long word',
                lo_location_offset=5,
                hi_location_offset=20,
                keyword_length=16,
                text_in_document='test a long word',
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
                keyword='long word',
                lo_location_offset=55,
                hi_location_offset=63,
                keyword_length=16,
                text_in_document='long word',
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
                keyword='a long word',
                lo_location_offset=22,
                hi_location_offset=32,
                keyword_length=10,
                text_in_document='a long word',
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
                text_in_document='a long word',
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
        ]),
    ],
)
def test_fix_conflicting_annotations(annotations_setup, index, annotations):
    annotation_service = get_test_annotations_service()
    fixed = annotation_service.fix_conflicting_annotations(
        unified_annotations=annotations,
    )

    if index == 1:
        assert len(fixed) == 1
        assert fixed[0] == annotations[1]
    elif index == 2:
        assert len(fixed) == 1
        assert fixed[0] == annotations[0]
    elif index == 3:
        assert len(fixed) == 2
        assert annotations[0] in fixed
        assert annotations[1] in fixed
    elif index == 4:
        assert len(fixed) == 1
        assert fixed[0] == annotations[0]
    elif index == 5:
        assert len(fixed) == 1
        assert fixed[0] == annotations[0]
    elif index == 6:
        assert len(fixed) == 2
        assert annotations[0] in fixed
        assert annotations[1] not in fixed
        assert annotations[2] in fixed
    elif index == 7:
        # test adjacent intervals
        assert len(fixed) == 1
        assert fixed[0] == annotations[0]
    elif index == 8:
        # test adjacent intervals
        assert len(fixed) == 1
        assert fixed[0] == annotations[1]


def test_escherichia_coli_pdf(
    escherichia_coli_pdf_lmdb_setup,
    mock_get_gene_to_organism_match_result_for_escherichia_coli_pdf,
):
    annotation_service = get_test_annotations_service(
        genes_lmdb_path=path.join(directory, 'lmdb/genes'),
        chemicals_lmdb_path=path.join(directory, 'lmdb/chemicals'),
        compounds_lmdb_path=path.join(directory, 'lmdb/compounds'),
        proteins_lmdb_path=path.join(directory, 'lmdb/proteins'),
        species_lmdb_path=path.join(directory, 'lmdb/species'),
        diseases_lmdb_path=path.join(directory, 'lmdb/diseases'),
        phenotypes_lmdb_path=path.join(directory, 'lmdb/phenotypes'),
    )
    pdf_parser = get_annotations_pdf_parser()

    pdf = path.join(directory, f'pdf_samples/ecoli_gene_test.pdf')

    with open(pdf, 'rb') as f:
        pdf_text = pdf_parser.parse_pdf(pdf=f)
        annotations = annotation_service.create_rules_based_annotations(
            tokens=pdf_parser.extract_tokens(parsed_chars=pdf_text))

    keywords = {o.keyword: o.meta.keyword_type for o in annotations}

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


def test_human_gene_pdf(
    human_gene_pdf_lmdb_setup,
    human_gene_pdf_gene_and_organism_network,
    mock_get_gene_to_organism_match_result_for_human_gene_pdf,
):
    annotation_service = get_test_annotations_service(
        genes_lmdb_path=path.join(directory, 'lmdb/genes'),
        chemicals_lmdb_path=path.join(directory, 'lmdb/chemicals'),
        compounds_lmdb_path=path.join(directory, 'lmdb/compounds'),
        proteins_lmdb_path=path.join(directory, 'lmdb/proteins'),
        species_lmdb_path=path.join(directory, 'lmdb/species'),
        diseases_lmdb_path=path.join(directory, 'lmdb/diseases'),
        phenotypes_lmdb_path=path.join(directory, 'lmdb/phenotypes'),
    )
    pdf_parser = get_annotations_pdf_parser()

    pdf = path.join(directory, f'pdf_samples/human_gene_test.pdf')

    with open(pdf, 'rb') as f:
        pdf_text = pdf_parser.parse_pdf(pdf=f)
        annotations = annotation_service.create_rules_based_annotations(
            tokens=pdf_parser.extract_tokens(parsed_chars=pdf_text))

    keywords = {o.keyword: o.meta.keyword_type for o in annotations}

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
):
    annotation_service = get_test_annotations_service(
        genes_lmdb_path=path.join(directory, 'lmdb/genes'),
        chemicals_lmdb_path=path.join(directory, 'lmdb/chemicals'),
        compounds_lmdb_path=path.join(directory, 'lmdb/compounds'),
        proteins_lmdb_path=path.join(directory, 'lmdb/proteins'),
        species_lmdb_path=path.join(directory, 'lmdb/species'),
        diseases_lmdb_path=path.join(directory, 'lmdb/diseases'),
        phenotypes_lmdb_path=path.join(directory, 'lmdb/phenotypes'),
    )

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
        ),
    )

    assert len(annotations) == 4
    assert annotations[0].keyword == 'hyp27'
    assert annotations[0].meta.keyword_type == EntityType.Gene.value

    assert annotations[1].keyword == 'Moniliophthora roreri'
    assert annotations[1].meta.keyword_type == EntityType.Species.value

    assert annotations[2].keyword == 'Hyp27'
    assert annotations[2].meta.keyword_type == EntityType.Protein.value

    assert annotations[3].keyword == 'human'
    assert annotations[3].meta.keyword_type == EntityType.Species.value


@pytest.mark.parametrize(
    'index, tokens',
    [
        (1, [
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
        (2, [
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
        (3, [
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
        (4, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='serpin A1',
                    char_positions={0: 'S', 1: 'e', 2: 'r', 3: 'p', 4: 'i', 5: 'n', 7: 'A', 8: '1'},
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='human',
                    char_positions={10: 'h', 11: 'u', 12: 'm', 13: 'a', 14: 'n'},
                ),
        ]),
    ],
)
def test_tokens_gene_vs_protein_serpina1_cases(
    default_lmdb_setup,
    mock_get_gene_to_organism_serpina1_match_result,
    index,
    tokens,
):
    annotation_service = get_test_annotations_service(
        genes_lmdb_path=path.join(directory, 'lmdb/genes'),
        chemicals_lmdb_path=path.join(directory, 'lmdb/chemicals'),
        compounds_lmdb_path=path.join(directory, 'lmdb/compounds'),
        proteins_lmdb_path=path.join(directory, 'lmdb/proteins'),
        species_lmdb_path=path.join(directory, 'lmdb/species'),
        diseases_lmdb_path=path.join(directory, 'lmdb/diseases'),
        phenotypes_lmdb_path=path.join(directory, 'lmdb/phenotypes'),
    )

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
        ),
    )

    if index == 1:
        assert len(annotations) == 2
        assert annotations[0].keyword == 'serpina1'
        assert annotations[0].meta.keyword_type == EntityType.Gene.value

        assert annotations[1].keyword == 'human'
        assert annotations[1].meta.keyword_type == EntityType.Species.value
    elif index == 2 or index == 4:
        assert len(annotations) == 2
        assert annotations[0].keyword == 'Serpin A1'
        assert annotations[0].meta.keyword_type == EntityType.Protein.value

        assert annotations[1].keyword == 'human'
        assert annotations[1].meta.keyword_type == EntityType.Species.value
    elif index == 3:
        assert len(annotations) == 2
        assert annotations[0].keyword == 'Serpin A1'
        assert annotations[0].meta.keyword_type == EntityType.Protein.value

        assert annotations[1].keyword == 'human'
        assert annotations[1].meta.keyword_type == EntityType.Species.value


@pytest.mark.parametrize(
    'index, tokens',
    [
        (1, [
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
def test_tokens_gene_vs_protein_serpina1_case_all_caps_from_knowledge_graph(
    default_lmdb_setup,
    mock_get_gene_to_organism_serpina1_match_result_all_caps,
    index,
    tokens,
):
    annotation_service = get_test_annotations_service(
        genes_lmdb_path=path.join(directory, 'lmdb/genes'),
        chemicals_lmdb_path=path.join(directory, 'lmdb/chemicals'),
        compounds_lmdb_path=path.join(directory, 'lmdb/compounds'),
        proteins_lmdb_path=path.join(directory, 'lmdb/proteins'),
        species_lmdb_path=path.join(directory, 'lmdb/species'),
        diseases_lmdb_path=path.join(directory, 'lmdb/diseases'),
        phenotypes_lmdb_path=path.join(directory, 'lmdb/phenotypes'),
    )

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
        ),
    )

    assert len(annotations) == 2
    # because KG returned a gene name of all caps
    # it does not match the text in document so was not
    # annotated as a gene
    # because we assume gene names from KG are case sensitive
    assert annotations[0].keyword == 'Serpin A1'
    assert annotations[0].meta.keyword_type == EntityType.Protein.value

    assert annotations[1].keyword == 'human'
    assert annotations[1].meta.keyword_type == EntityType.Species.value


@pytest.mark.skip(reason="This is not a good test")
def test_save_bioc_annotations_to_db(default_lmdb_setup, session):
    annotator = get_test_annotations_service(
        genes_lmdb_path=path.join(directory, 'lmdb/genes'),
        chemicals_lmdb_path=path.join(directory, 'lmdb/chemicals'),
        compounds_lmdb_path=path.join(directory, 'lmdb/compounds'),
        proteins_lmdb_path=path.join(directory, 'lmdb/proteins'),
        species_lmdb_path=path.join(directory, 'lmdb/species'),
        diseases_lmdb_path=path.join(directory, 'lmdb/diseases'),
        phenotypes_lmdb_path=path.join(directory, 'lmdb/phenotypes'),
    )
    pdf_parser = get_annotations_pdf_parser()
    bioc_service = get_bioc_document_service()

    pdf = path.join(directory, 'pdf_samples/Branched-Chain Amino Acid Metabolism.pdf')

    with open(pdf, 'rb') as f:
        parsed_pdf_chars = pdf_parser.parse_pdf(pdf=f)
        tokens = pdf_parser.extract_tokens(parsed_chars=parsed_pdf_chars)
        pdf_text_list = pdf_parser.combine_chars_into_words(parsed_pdf_chars)
        pdf_text = ' '.join([text for text, _ in pdf_text_list])
        annotations = annotator.create_rules_based_annotations(tokens=tokens)

    bioc = bioc_service.read(
        text=pdf_text,
        file_uri=path.join(directory, 'pdf_samples/Branched-Chain Amino Acid Metabolism.pdf'))
    annotations_json = bioc_service.generate_bioc_json(annotations=annotations, bioc=bioc)

    annotated_json_f = path.join(directory, 'pdf_samples/annotations-test.json')
    with open(annotated_json_f, 'w') as a_f:
        json.dump(annotations_json, a_f)

    file_content = FileContent(
        raw_file=b'',
        checksum_sha256=b'checksum_sha256',
    )

    session.add(file_content)
    session.flush()

    f = Files(
        file_id=123,
        filename='filename',
        description='description',
        content_id=file_content.id,
        user_id=3,
        annotations=annotations_json,
        annotations_date='1970-01-01 00:00:00',
        project=1,
        doi='doi',
        upload_url='upload_url',
    )

    session.add(f)
    session.commit()

    pdf_file_model = session.query(Files).first()
    assert pdf_file_model.filename == 'filename'
    assert pdf_file_model.file_id == '123'
    assert pdf_file_model.annotations == annotations_json


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
                    keyword_type=EntityType.Gene.value,
                    color='',
                    id='',
                    id_type='',
                    id_hyperlink='',
                    links=Annotation.Meta.Links(),
                    category=OrganismCategory.Bacteria.value,
                ),
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
                    keyword_type=EntityType.Gene.value,
                    color='',
                    id='',
                    id_type='',
                    id_hyperlink='',
                    links=Annotation.Meta.Links(),
                    category=OrganismCategory.Eukaryota.value,
                ),
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
                    keyword_type=EntityType.Gene.value,
                    color='',
                    id='',
                    id_type='',
                    id_hyperlink='',
                    links=Annotation.Meta.Links(),
                    category=OrganismCategory.Bacteria.value,
                ),
            ),
        ]),
    ],
)
def test_fix_false_positive_gene_annotations(annotations_setup, index, annotations):
    annotation_service = get_test_annotations_service()
    fixed = annotation_service._get_fixed_false_positive_unified_annotations(
        annotations_list=annotations,
    )

    if index == 1:
        # gene annotation should be removed
        # if it's a bacteria gene but the last
        # letter is not capitalized
        assert len(fixed) == 0
    elif index == 2:
        # if correct gene synonym is all caps
        # but text in document is not
        # then remove the annotation
        assert len(fixed) == 0
    elif index == 3:
        # bacteria gene should have three lowercase
        # with one uppercase at the end
        assert len(fixed) == 0


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
                    keyword_type=EntityType.Gene.value,
                    color='',
                    id='102353780',
                    id_type='',
                    id_hyperlink='',
                    links=Annotation.Meta.Links(),
                    category=OrganismCategory.Eukaryota.value,
                ),
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
                    keyword_type=EntityType.Protein.value,
                    color='',
                    id='12379999999',
                    id_type='',
                    id_hyperlink='',
                    links=Annotation.Meta.Links(),
                ),
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
                    keyword_type=EntityType.Gene.value,
                    color='',
                    id='10235378012123',
                    id_type='',
                    id_hyperlink='',
                    links=Annotation.Meta.Links(),
                    category=OrganismCategory.Eukaryota.value,
                ),
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
                    keyword_type=EntityType.Protein.value,
                    color='',
                    id='12379999999',
                    id_type='',
                    id_hyperlink='',
                    links=Annotation.Meta.Links(),
                ),
            ),
        ]),
    ],
)
def test_gene_vs_protein_annotations(
    annotations_setup,
    index,
    annotations,
    fish_gene_lmdb_setup,
):
    annotation_service = get_test_annotations_service(
        genes_lmdb_path=path.join(directory, 'lmdb/genes'),
        chemicals_lmdb_path=path.join(directory, 'lmdb/chemicals'),
        compounds_lmdb_path=path.join(directory, 'lmdb/compounds'),
        proteins_lmdb_path=path.join(directory, 'lmdb/proteins'),
        species_lmdb_path=path.join(directory, 'lmdb/species'),
        diseases_lmdb_path=path.join(directory, 'lmdb/diseases'),
        phenotypes_lmdb_path=path.join(directory, 'lmdb/phenotypes'),
    )
    fixed = annotation_service.fix_conflicting_annotations(
        unified_annotations=annotations,
    )

    if index == 1:
        assert len(fixed) == 1
        assert fixed[0] == annotations[1]
    elif index == 2:
        assert len(fixed) == 1
        assert fixed[0] == annotations[0]


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
):
    annotation_service = get_test_annotations_service(
        genes_lmdb_path=path.join(directory, 'lmdb/genes'),
        chemicals_lmdb_path=path.join(directory, 'lmdb/chemicals'),
        compounds_lmdb_path=path.join(directory, 'lmdb/compounds'),
        proteins_lmdb_path=path.join(directory, 'lmdb/proteins'),
        species_lmdb_path=path.join(directory, 'lmdb/species'),
        diseases_lmdb_path=path.join(directory, 'lmdb/diseases'),
        phenotypes_lmdb_path=path.join(directory, 'lmdb/phenotypes'),
    )

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
        ),
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
):
    annotation_service = get_test_annotations_service(
        genes_lmdb_path=path.join(directory, 'lmdb/genes'),
        chemicals_lmdb_path=path.join(directory, 'lmdb/chemicals'),
        compounds_lmdb_path=path.join(directory, 'lmdb/compounds'),
        proteins_lmdb_path=path.join(directory, 'lmdb/proteins'),
        species_lmdb_path=path.join(directory, 'lmdb/species'),
        diseases_lmdb_path=path.join(directory, 'lmdb/diseases'),
        phenotypes_lmdb_path=path.join(directory, 'lmdb/phenotypes'),
    )

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
        ),
    )

    if index == 1:
        for a in annotations:
            if a.text_in_document == 'EDEM3':
                # id should change to match KG
                # value from mock_get_gene_to_organism_match_result_for_human_rat_gene
                assert annotations[1].meta.id == '80267'
