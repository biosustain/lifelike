import attr
import json
import pytest

from os import path
from uuid import uuid4

from pdfminer.layout import LTChar

from neo4japp.database import get_annotations_pdf_parser
from neo4japp.data_transfer_objects import (
    Annotation,
    GeneAnnotation,
    PDFParsedCharacters,
    PDFTokenPositions,
    PDFTokenPositionsList,
    SpecifiedOrganismStrain
)
from neo4japp.services.annotations.constants import EntityType, OrganismCategory
from neo4japp.services.annotations.util import normalize_str


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


def lookup_entities(
    entity_service,
    tokens,
    custom_annotations=[],
    excluded_annotations=[]
):
    entity_service.set_entity_inclusions(custom_annotations)
    entity_service.set_entity_exclusions(excluded_annotations)
    entity_service.identify_entities(
        tokens=tokens.token_positions,
        check_entities_in_lmdb=entity_service.get_entities_to_identify()
    )


def process_tokens(mock_tokens, abbrev=False, index=None):
    char_coord_objs_in_pdf = []
    word_index_dict = {}

    for i, t in enumerate(mock_tokens):
        length = len(t.keyword)
        count = 0
        added_parenth = False
        for c in t.keyword:
            if abbrev and i == index:
                if not added_parenth:
                    char_coord_objs_in_pdf.append(get_dummy_LTChar(text='('))
                    added_parenth = True

                char_coord_objs_in_pdf.append(get_dummy_LTChar(text=c))
                count += 1
                if count == length:
                    char_coord_objs_in_pdf.append(get_dummy_LTChar(text=')'))
            else:
                char_coord_objs_in_pdf.append(get_dummy_LTChar(text=c))
        char_coord_objs_in_pdf.append(get_dummy_LTChar(text=' '))

        if len(t.keyword.split()) == 1:
            word_index_dict[list(t.char_positions)[0]] = t.keyword
        else:
            words = t.keyword.split()
            prev = -1
            count = 0
            for i, (k, v) in enumerate(t.char_positions.items()):
                if i == 0:
                    word_index_dict[k] = words[count]
                    count += 1
                else:
                    if t.char_positions[prev] == ' ':
                        word_index_dict[k] = words[count]
                        count += 1
                prev = k

    return char_coord_objs_in_pdf, word_index_dict


def create_mock_tokens(annotations):
    return [
        PDFTokenPositions(
            page_number=anno.page_number,
            keyword=anno.keyword,
            char_positions={
                i + anno.lo_location_offset: c for i, c in enumerate(anno.keyword)},
            normalized_keyword=normalize_str(anno.keyword)
        ) for anno in annotations
    ]


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
                    type=EntityType.GENE.value,
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
                    type=EntityType.GENE.value,
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
                    type=EntityType.GENE.value,
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
                    type=EntityType.CHEMICAL.value,
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
                    type=EntityType.GENE.value,
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
                    type=EntityType.CHEMICAL.value,
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
                    type=EntityType.GENE.value,
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
                    type=EntityType.CHEMICAL.value,
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
                    type=EntityType.GENE.value,
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
                    type=EntityType.GENE.value,
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
                    type=EntityType.CHEMICAL.value,
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
                    type=EntityType.CHEMICAL.value,
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
                    type=EntityType.GENE.value,
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
                    type=EntityType.CHEMICAL.value,
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
                    type=EntityType.CHEMICAL.value,
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
                    type=EntityType.CHEMICAL.value,
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


def test_gene_organism_escherichia_coli_pdf(
    gene_organism_escherichia_coli_pdf_lmdb_setup,
    mock_get_gene_to_organism_match_result_for_escherichia_coli_pdf,
    get_annotations_service,
    entity_service
):
    annotation_service = get_annotations_service
    pdf_parser = get_annotations_pdf_parser()
    entity_service = entity_service

    pdf = path.join(directory, f'pdf_samples/ecoli_gene_test.pdf')

    with open(pdf, 'rb') as f:
        pdf_text = pdf_parser.parse_pdf(pdf=f)
        tokens = pdf_parser.extract_tokens(parsed_chars=pdf_text)

        lookup_entities(entity_service=entity_service, tokens=tokens)
        annotations = annotation_service.create_rules_based_annotations(
            tokens=tokens,
            entity_results=entity_service.get_entity_match_results(),
            entity_type_and_id_pairs=annotation_service.get_entities_to_annotate(),
            specified_organism=SpecifiedOrganismStrain(
                    synonym='', organism_id='', category='')
        )

    keywords = {o.keyword: o.meta.type for o in annotations}

    assert 'Escherichia coli' in keywords
    assert keywords['Escherichia coli'] == EntityType.SPECIES.value

    assert 'purA' in keywords
    assert keywords['purA'] == EntityType.GENE.value

    assert 'purB' in keywords
    assert keywords['purB'] == EntityType.GENE.value

    assert 'purC' in keywords
    assert keywords['purC'] == EntityType.GENE.value

    assert 'purD' in keywords
    assert keywords['purD'] == EntityType.GENE.value

    assert 'purF' in keywords
    assert keywords['purF'] == EntityType.GENE.value


def test_protein_organism_escherichia_coli_pdf(
    protein_organism_escherichia_coli_pdf_lmdb_setup,
    mock_get_protein_to_organism_match_result_for_escherichia_coli_pdf,
    get_annotations_service,
    entity_service
):
    annotation_service = get_annotations_service
    pdf_parser = get_annotations_pdf_parser()
    entity_service = entity_service

    pdf = path.join(directory, f'pdf_samples/ecoli_protein_test.pdf')

    with open(pdf, 'rb') as f:
        pdf_text = pdf_parser.parse_pdf(pdf=f)
        tokens = pdf_parser.extract_tokens(parsed_chars=pdf_text)

        lookup_entities(entity_service=entity_service, tokens=tokens)

        annotations = annotation_service.create_rules_based_annotations(
            tokens=tokens,
            entity_results=entity_service.get_entity_match_results(),
            entity_type_and_id_pairs=annotation_service.get_entities_to_annotate(),
            specified_organism=SpecifiedOrganismStrain(
                    synonym='', organism_id='', category='')
        )

    keywords = {o.keyword: o.meta.id for o in annotations}

    assert 'YdhC' in keywords
    assert keywords['YdhC'] == 'P37597'


def test_custom_annotations_gene_organism_matching_has_match(
    default_lmdb_setup,
    mock_general_human_genes,
    get_annotations_service,
    entity_service
):
    annotation_service = get_annotations_service
    pdf_parser = get_annotations_pdf_parser()
    entity_service = entity_service

    pdf = path.join(directory, f'pdf_samples/custom_annotations_gene_matching.pdf')

    custom_annotation = {
        'meta': {
            'id': '9606',
            'type': 'Species',
            'color': '#0277bd',
            'links': {
                'ncbi': 'https://www.ncbi.nlm.nih.gov/gene/?query=hooman',
                'mesh': 'https://www.ncbi.nlm.nih.gov/mesh/?term=hooman',
                'chebi': 'https://www.ebi.ac.uk/chebi/advancedSearchFT.do?searchString=hooman',
                'pubchem': 'https://pubchem.ncbi.nlm.nih.gov/#query=hooman',
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
        tokens = pdf_parser.extract_tokens(parsed_chars=pdf_text)

        lookup_entities(
            entity_service=entity_service,
            tokens=tokens,
            custom_annotations=[custom_annotation]
        )
        annotations = annotation_service.create_rules_based_annotations(
            tokens=tokens,
            entity_results=entity_service.get_entity_match_results(),
            entity_type_and_id_pairs=annotation_service.get_entities_to_annotate(),
            specified_organism=SpecifiedOrganismStrain(
                    synonym='', organism_id='', category='')
        )

    # custom annotations inclusions are taken into account
    # when annotating
    assert len(annotations) == 3
    assert annotations[1].meta.id == '388962'  # human gene


def test_custom_local_annotations(
    default_lmdb_setup,
    mock_general_human_genes,
    mock_gene_exclusion,
    get_annotations_service,
    entity_service
):
    annotation_service = get_annotations_service
    pdf_parser = get_annotations_pdf_parser()
    entity_service = entity_service

    pdf = path.join(directory, f'pdf_samples/custom_annotations_gene_matching.pdf')

    local_inclusion = {
        'meta': {
            'id': '9606',
            'type': 'Species',
            'color': '#0277bd',
            'links': {
                'ncbi': 'https://www.ncbi.nlm.nih.gov/gene/?query=hooman',
                'mesh': 'https://www.ncbi.nlm.nih.gov/mesh/?term=hooman',
                'chebi': 'https://www.ebi.ac.uk/chebi/advancedSearchFT.do?searchString=hooman',
                'pubchem': 'https://pubchem.ncbi.nlm.nih.gov/#query=hooman',
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

    local_exclusion = {
        'id': '37293',
        'text': 'BOLA3',
        'type': 'Gene',
        'rects': [[381.21680400799994, 706.52786608, 473.9653966747998, 718.27682008]],
        'reason': 'Not an entity',
        'comment': '',
        'user_id': 1,
        'pageNumber': 1,
        'idHyperlink': '',
        'excludeGlobally': False
    }

    with open(pdf, 'rb') as f:
        pdf_text = pdf_parser.parse_pdf(pdf=f)
        tokens = pdf_parser.extract_tokens(parsed_chars=pdf_text)

        lookup_entities(
            entity_service=entity_service,
            tokens=tokens,
            custom_annotations=[local_inclusion],
            excluded_annotations=[local_exclusion]
        )
        annotations = annotation_service.create_rules_based_annotations(
            tokens=tokens,
            entity_results=entity_service.get_entity_match_results(),
            entity_type_and_id_pairs=annotation_service.get_entities_to_annotate(),
            specified_organism=SpecifiedOrganismStrain(
                    synonym='', organism_id='', category='')
        )

    # custom annotations inclusions are taken into account
    # when annotating
    assert len(annotations) == 2
    assert annotations[0].text_in_document != 'BOLA3'
    assert annotations[1].text_in_document != 'BOLA3'


def test_human_gene_pdf(
    human_gene_pdf_lmdb_setup,
    human_gene_pdf_gene_and_organism_network,
    mock_get_gene_to_organism_match_result_for_human_gene_pdf,
    get_annotations_service,
    entity_service
):
    annotation_service = get_annotations_service
    pdf_parser = get_annotations_pdf_parser()
    entity_service = entity_service

    pdf = path.join(directory, f'pdf_samples/human_gene_test.pdf')

    with open(pdf, 'rb') as f:
        pdf_text = pdf_parser.parse_pdf(pdf=f)
        tokens = pdf_parser.extract_tokens(parsed_chars=pdf_text)

        lookup_entities(entity_service=entity_service, tokens=tokens)
        annotations = annotation_service.create_rules_based_annotations(
            tokens=tokens,
            entity_results=entity_service.get_entity_match_results(),
            entity_type_and_id_pairs=annotation_service.get_entities_to_annotate(),
            specified_organism=SpecifiedOrganismStrain(
                    synonym='', organism_id='', category='')
        )

    keywords = {o.keyword: o.meta.type for o in annotations}

    assert 'COVID-19' in keywords
    assert keywords['COVID-19'] == EntityType.DISEASE.value

    assert 'MERS-CoV' in keywords
    assert keywords['MERS-CoV'] == EntityType.SPECIES.value

    assert 'ACE2' in keywords
    assert keywords['ACE2'] == EntityType.GENE.value


def test_foods_pdf(
    food_lmdb_setup,
    get_annotations_service,
    entity_service
):
    annotation_service = get_annotations_service
    pdf_parser = get_annotations_pdf_parser()
    entity_service = entity_service

    pdf = path.join(directory, f'pdf_samples/food-test.pdf')

    with open(pdf, 'rb') as f:
        pdf_text = pdf_parser.parse_pdf(pdf=f)
        tokens = pdf_parser.extract_tokens(parsed_chars=pdf_text)

        lookup_entities(entity_service=entity_service, tokens=tokens)
        annotations = annotation_service.create_rules_based_annotations(
            tokens=tokens,
            entity_results=entity_service.get_entity_match_results(),
            entity_type_and_id_pairs=annotation_service.get_entities_to_annotate(),
            specified_organism=SpecifiedOrganismStrain(
                    synonym='', organism_id='', category='')
        )

    keywords = {o.keyword: o.meta.type for o in annotations}

    assert 'Artificial Sweeteners' in keywords
    assert keywords['Artificial Sweeteners'] == EntityType.FOOD.value

    assert 'Bacon' in keywords
    assert keywords['Bacon'] == EntityType.FOOD.value


def test_anatomy_pdf(
    anatomy_lmdb_setup,
    get_annotations_service,
    entity_service
):
    annotation_service = get_annotations_service
    pdf_parser = get_annotations_pdf_parser()
    entity_service = entity_service

    pdf = path.join(directory, f'pdf_samples/anatomy-test.pdf')

    with open(pdf, 'rb') as f:
        pdf_text = pdf_parser.parse_pdf(pdf=f)
        tokens = pdf_parser.extract_tokens(parsed_chars=pdf_text)

        lookup_entities(entity_service=entity_service, tokens=tokens)
        annotations = annotation_service.create_rules_based_annotations(
            tokens=tokens,
            entity_results=entity_service.get_entity_match_results(),
            entity_type_and_id_pairs=annotation_service.get_entities_to_annotate(),
            specified_organism=SpecifiedOrganismStrain(
                    synonym='', organism_id='', category='')
        )

    keywords = {o.keyword: o.meta.type for o in annotations}

    assert '280 kDa Actin Binding Protein' in keywords
    assert keywords['280 kDa Actin Binding Protein'] == EntityType.ANATOMY.value

    assert 'Claws' in keywords
    assert keywords['Claws'] == EntityType.ANATOMY.value


@pytest.mark.parametrize(
    'mock_tokens',
    [
        [
            PDFTokenPositions(
                page_number=1,
                keyword='hyp27',
                char_positions={
                    i: c for i, c in enumerate('hyp27')},
                normalized_keyword='hyp27'
            ),
            PDFTokenPositions(
                page_number=1,
                keyword='Moniliophthora roreri',
                char_positions={
                    i + len('hyp27') + 1: c for i, c in enumerate('Moniliophthora roreri')},  # noqa
                normalized_keyword='moniliophthoraroreri'
            ),
            PDFTokenPositions(
                page_number=1,
                keyword='Hyp27',
                char_positions={
                    i + len('hyp27') + len('Moniliophthora roreri') + 2: c for i, c in enumerate('Hyp27')},  # noqa
                normalized_keyword='hyp27'
            ),
            PDFTokenPositions(
                page_number=1,
                keyword='human',
                char_positions={
                    i + len('hyp27') + len('Moniliophthora roreri') + len('Hyp27') + 3: c for i, c in enumerate('human')},  # noqa
                normalized_keyword='human'
            ),
        ]
    ],
)
def test_tokens_gene_vs_protein(
    default_lmdb_setup,
    mock_get_gene_to_organism_match_result,
    mock_tokens,
    get_annotations_service,
    entity_service
):
    annotation_service = get_annotations_service
    entity_service = entity_service

    char_coord_objs_in_pdf, word_index_dict = process_tokens(mock_tokens)

    tokens = PDFTokenPositionsList(
        token_positions=mock_tokens,
        char_coord_objs_in_pdf=char_coord_objs_in_pdf,
        cropbox_in_pdf=(5, 5),
        min_idx_in_page={0: 1},
        word_index_dict=word_index_dict
    )

    lookup_entities(entity_service=entity_service, tokens=tokens)
    annotations = annotation_service.create_rules_based_annotations(
        tokens=tokens,
        entity_results=entity_service.get_entity_match_results(),
        entity_type_and_id_pairs=annotation_service.get_entities_to_annotate(),
        specified_organism=SpecifiedOrganismStrain(
                synonym='', organism_id='', category='')
    )

    assert len(annotations) == 4
    assert annotations[0].keyword == 'hyp27'
    assert annotations[0].meta.type == EntityType.GENE.value

    assert annotations[1].keyword == 'Moniliophthora roreri'
    assert annotations[1].meta.type == EntityType.SPECIES.value

    assert annotations[2].keyword == 'Hyp27'
    assert annotations[2].meta.type == EntityType.PROTEIN.value

    assert annotations[3].keyword == 'human'
    assert annotations[3].meta.type == EntityType.SPECIES.value


@pytest.mark.parametrize(
    'index, mock_tokens',
    [
        (1, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='Serpin A1',
                    char_positions={
                        i: c for i, c in enumerate('Serpin A1')
                    },
                    normalized_keyword='serpina1'
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='human',
                    char_positions={
                        i + len('Serpin A1') + 1: c for i, c in enumerate('human')
                    },
                    normalized_keyword='human'
                ),
        ]),
        # overlapping intervals
        (2, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='SERPIN',
                    char_positions={
                        i: c for i, c in enumerate('SERPIN')
                    },
                    normalized_keyword='serpin'
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='SERPIN A1',
                    char_positions={
                        i + len('SERPIN') + 1: c for i, c in enumerate('SERPINA A1')},  # noqa
                    normalized_keyword='serpina1'
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='human',
                    char_positions={
                        i + len('SERPIN') + len('SERPINA A1') + 2: c for i, c in enumerate('human')},  # noqa
                    normalized_keyword='human'
                ),
        ]),
        (3, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='serpina1',
                    char_positions={
                        i: c for i, c in enumerate('serpina1')
                    },
                    normalized_keyword='serpina1'
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='human',
                    char_positions={
                        i + len('serpina1') + 1: c for i, c in enumerate('human')
                    },
                    normalized_keyword='human'
                ),
        ]),
        (4, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='SERPINA1',
                    char_positions={
                        i: c for i, c in enumerate('SERPINA1')
                    },
                    normalized_keyword='serpina1'
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='human',
                    char_positions={
                        i + len('SERPINA1') + 1: c for i, c in enumerate('human')
                    },
                    normalized_keyword='human'
                ),
        ]),
        (5, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='SerpinA1',
                    char_positions={
                        i: c for i, c in enumerate('SerpinA1')
                    },
                    normalized_keyword='serpina1'
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='human',
                    char_positions={
                        i + len('SerpinA1') + 1: c for i, c in enumerate('human')
                    },
                    normalized_keyword='human'
                ),
        ]),
    ],
)
def test_tokens_gene_vs_protein_serpina1_cases(
    default_lmdb_setup,
    mock_get_gene_to_organism_serpina1_match_result,
    index,
    mock_tokens,
    get_annotations_service,
    entity_service
):
    annotation_service = get_annotations_service
    entity_service = entity_service

    char_coord_objs_in_pdf, word_index_dict = process_tokens(mock_tokens)

    tokens = PDFTokenPositionsList(
        token_positions=mock_tokens,
        char_coord_objs_in_pdf=char_coord_objs_in_pdf,
        cropbox_in_pdf=(5, 5),
        min_idx_in_page={0: 1},
        word_index_dict=word_index_dict
    )

    lookup_entities(entity_service=entity_service, tokens=tokens)
    annotations = annotation_service.create_rules_based_annotations(
        tokens=tokens,
        entity_results=entity_service.get_entity_match_results(),
        entity_type_and_id_pairs=annotation_service.get_entities_to_annotate(),
        specified_organism=SpecifiedOrganismStrain(
                synonym='', organism_id='', category='')
    )

    if index == 1 or index == 2:
        assert len(annotations) == 2
        assert annotations[0].keyword == 'Serpin A1'
        assert annotations[0].meta.type == EntityType.PROTEIN.value

        assert annotations[1].keyword == 'human'
        assert annotations[1].meta.type == EntityType.SPECIES.value
    elif index == 3:
        assert len(annotations) == 2
        assert annotations[0].keyword == 'serpina1'
        assert annotations[0].meta.type == EntityType.GENE.value

        assert annotations[1].keyword == 'human'
        assert annotations[1].meta.type == EntityType.SPECIES.value
    elif index == 4:
        assert len(annotations) == 2
        assert annotations[0].keyword == 'SERPINA1'
        assert annotations[0].meta.type == EntityType.GENE.value

        assert annotations[1].keyword == 'human'
        assert annotations[1].meta.type == EntityType.SPECIES.value
    elif index == 5:
        assert len(annotations) == 1
        assert annotations[0].keyword == 'human'
        assert annotations[0].meta.type == EntityType.SPECIES.value


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
                    type=EntityType.GENE.value,
                    color='',
                    id='',
                    id_type='',
                    id_hyperlink='',
                    links=Annotation.Meta.Links(),
                    category=OrganismCategory.BACTERIA.value,
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
                    type=EntityType.GENE.value,
                    color='',
                    id='',
                    id_type='',
                    id_hyperlink='',
                    links=Annotation.Meta.Links(),
                    category=OrganismCategory.EUKARYOTA.value,
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
                    type=EntityType.GENE.value,
                    color='',
                    id='',
                    id_type='',
                    id_hyperlink='',
                    links=Annotation.Meta.Links(),
                    category=OrganismCategory.BACTERIA.value,
                ),
                uuid='',
            ),
        ]),
    ],
)
def test_fix_false_positive_gene_annotations(get_annotations_service, index, annotations):
    annotation_service = get_annotations_service

    char_coord_objs_in_pdf, word_index_dict = process_tokens(
        create_mock_tokens(annotations))

    fixed = annotation_service._get_fixed_false_positive_unified_annotations(
        annotations_list=annotations,
        char_coord_objs_in_pdf=char_coord_objs_in_pdf,
        word_index_dict=word_index_dict
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
            Annotation(
                page_number=1,
                keyword='SidE',
                lo_location_offset=5,
                hi_location_offset=8,
                keyword_length=4,
                text_in_document='side',
                keywords=[''],
                rects=[[1, 2]],
                meta=Annotation.Meta(
                    type=EntityType.PROTEIN.value,
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
            GeneAnnotation(
                page_number=1,
                keyword='Tir',
                lo_location_offset=5,
                hi_location_offset=7,
                keyword_length=3,
                text_in_document='TIR',
                keywords=[''],
                rects=[[1, 2]],
                meta=Annotation.Meta(
                    type=EntityType.PROTEIN.value,
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
            GeneAnnotation(
                page_number=1,
                keyword='TraF',
                lo_location_offset=5,
                hi_location_offset=7,
                keyword_length=3,
                text_in_document='TraF',
                keywords=[''],
                rects=[[1, 2]],
                meta=Annotation.Meta(
                    type=EntityType.PROTEIN.value,
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
def test_fix_false_positive_protein_annotations(get_annotations_service, index, annotations):
    annotation_service = get_annotations_service

    char_coord_objs_in_pdf, word_index_dict = process_tokens(
        create_mock_tokens(annotations))

    fixed = annotation_service._get_fixed_false_positive_unified_annotations(
        annotations_list=annotations,
        char_coord_objs_in_pdf=char_coord_objs_in_pdf,
        word_index_dict=word_index_dict
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
                    type=EntityType.GENE.value,
                    color='',
                    id='102353780',
                    id_type='',
                    id_hyperlink='',
                    links=Annotation.Meta.Links(),
                    category=OrganismCategory.EUKARYOTA.value,
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
                    type=EntityType.PROTEIN.value,
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
                    type=EntityType.GENE.value,
                    color='',
                    id='10235378012123',
                    id_type='',
                    id_hyperlink='',
                    links=Annotation.Meta.Links(),
                    category=OrganismCategory.EUKARYOTA.value,
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
                    type=EntityType.PROTEIN.value,
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
    'index, mock_tokens',
    [
        (1, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='il-7',
                    char_positions={
                        i: c for i, c in enumerate('il-7')
                    },
                    normalized_keyword='il7'
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='coelacanth',
                    char_positions={
                        i + len('il-7') + 1: c for i, c in enumerate('coelacanth')},  # noqa
                    normalized_keyword='coelacanth'
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='Tetraodon rubripes',
                    char_positions={
                        i + len('il-7') + len('coelacanth') + 2: c for i, c in enumerate('Tetraodon rubripes')},  # noqa
                    normalized_keyword='tetraodonrubripes'
                ),
        ]),
    ],
)
def test_gene_annotation_uses_id_from_knowledge_graph(
    fish_gene_lmdb_setup,
    mock_get_gene_to_organism_match_result_for_fish_gene,
    index,
    mock_tokens,
    get_annotations_service,
    entity_service
):
    annotation_service = get_annotations_service
    entity_service = entity_service

    char_coord_objs_in_pdf, word_index_dict = process_tokens(mock_tokens)

    tokens = PDFTokenPositionsList(
        token_positions=mock_tokens,
        char_coord_objs_in_pdf=char_coord_objs_in_pdf,
        cropbox_in_pdf=(5, 5),
        min_idx_in_page={0: 1},
        word_index_dict=word_index_dict
    )

    lookup_entities(entity_service=entity_service, tokens=tokens)
    annotations = annotation_service.create_rules_based_annotations(
        tokens=tokens,
        entity_results=entity_service.get_entity_match_results(),
        entity_type_and_id_pairs=annotation_service.get_entities_to_annotate(),
        specified_organism=SpecifiedOrganismStrain(
                synonym='', organism_id='', category='')
    )

    if index == 1:
        # id should change to match KG
        # value from mock_get_gene_to_organism_match_result_for_fish_gene
        assert annotations[0].meta.id == '99999'


@pytest.mark.parametrize(
    'index, mock_tokens',
    [
        (1, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='rat',
                    char_positions={
                        i: c for i, c in enumerate('rat')
                    },
                    normalized_keyword='rat'
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='EDEM3',
                    char_positions={
                        i + len('rat') + 1: c for i, c in enumerate('EDEM3')},
                    normalized_keyword='edem3'
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='Human',
                    char_positions={
                        i + len('rat') + len('EDEM3') + 2: c for i, c in enumerate('Human')},  # noqa
                    normalized_keyword='human'
                ),
        ]),
    ],
)
def test_gene_annotation_human_vs_rat(
    human_rat_gene_lmdb_setup,
    mock_get_gene_to_organism_match_result_for_human_rat_gene,
    index,
    mock_tokens,
    get_annotations_service,
    entity_service
):
    annotation_service = get_annotations_service
    entity_service = entity_service

    char_coord_objs_in_pdf, word_index_dict = process_tokens(mock_tokens)

    tokens = PDFTokenPositionsList(
        token_positions=mock_tokens,
        char_coord_objs_in_pdf=char_coord_objs_in_pdf,
        cropbox_in_pdf=(5, 5),
        min_idx_in_page={0: 1},
        word_index_dict=word_index_dict
    )

    lookup_entities(entity_service=entity_service, tokens=tokens)
    annotations = annotation_service.create_rules_based_annotations(
        tokens=tokens,
        entity_results=entity_service.get_entity_match_results(),
        entity_type_and_id_pairs=annotation_service.get_entities_to_annotate(),
        specified_organism=SpecifiedOrganismStrain(
                synonym='', organism_id='', category='')
    )

    if index == 1:
        for a in annotations:
            if a.text_in_document == 'EDEM3':
                # id should change to match KG
                # value from mock_get_gene_to_organism_match_result_for_human_rat_gene
                assert annotations[1].meta.id == '80267'


@pytest.mark.parametrize(
    'index, mock_tokens',
    [
        (1, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='human',
                    char_positions={
                        i: c for i, c in enumerate('human')
                    },
                    normalized_keyword='human'
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='FO(-)',
                    char_positions={
                        i + len('human') + 1: c for i, c in enumerate('FO(-)')},  # noqa
                    normalized_keyword='fo'
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='H',
                    char_positions={
                        i + len('human') + len('FO(-)') + 2: c for i, c in enumerate('H') if c != ' '},  # noqa
                    normalized_keyword='h'
                ),
        ]),
    ],
)
def test_ignore_terms_length_two_or_less(
    default_lmdb_setup,
    mock_empty_gene_to_organism,
    index,
    mock_tokens,
    get_annotations_service,
    entity_service
):
    annotation_service = get_annotations_service
    entity_service = entity_service

    char_coord_objs_in_pdf, word_index_dict = process_tokens(mock_tokens)

    tokens = PDFTokenPositionsList(
        token_positions=mock_tokens,
        char_coord_objs_in_pdf=char_coord_objs_in_pdf,
        cropbox_in_pdf=(5, 5),
        min_idx_in_page={0: 1},
        word_index_dict=word_index_dict
    )

    lookup_entities(entity_service=entity_service, tokens=tokens)
    annotations = annotation_service.create_rules_based_annotations(
        tokens=tokens,
        entity_results=entity_service.get_entity_match_results(),
        entity_type_and_id_pairs=annotation_service.get_entities_to_annotate(),
        specified_organism=SpecifiedOrganismStrain(
                synonym='', organism_id='', category='')
    )

    assert len(annotations) == 1
    assert annotations[0].keyword == mock_tokens[0].keyword


def test_global_excluded_chemical_annotations(
    default_lmdb_setup,
    mock_global_chemical_exclusion,
    get_annotations_service,
    entity_service
):
    annotation_service = get_annotations_service
    pdf_parser = get_annotations_pdf_parser()
    entity_service = entity_service

    pdf = path.join(directory, f'pdf_samples/chemical_exclusion.pdf')

    with open(pdf, 'rb') as f:
        pdf_text = pdf_parser.parse_pdf(pdf=f)
        tokens = pdf_parser.extract_tokens(parsed_chars=pdf_text)

        lookup_entities(entity_service=entity_service, tokens=tokens)
        annotations = annotation_service.create_rules_based_annotations(
            tokens=tokens,
            entity_results=entity_service.get_entity_match_results(),
            entity_type_and_id_pairs=annotation_service.get_entities_to_annotate(),
            specified_organism=SpecifiedOrganismStrain(
                    synonym='', organism_id='', category='')
        )

    assert len(annotations) == 1
    assert 'hypofluorite' not in set([anno.keyword for anno in annotations])


def test_global_excluded_compound_annotations(
    default_lmdb_setup,
    mock_compound_exclusion,
    get_annotations_service,
    entity_service
):
    annotation_service = get_annotations_service
    pdf_parser = get_annotations_pdf_parser()
    entity_service = entity_service

    pdf = path.join(directory, f'pdf_samples/compound_exclusion.pdf')

    with open(pdf, 'rb') as f:
        pdf_text = pdf_parser.parse_pdf(pdf=f)
        tokens = pdf_parser.extract_tokens(parsed_chars=pdf_text)

        lookup_entities(entity_service=entity_service, tokens=tokens)
        annotations = annotation_service.create_rules_based_annotations(
            tokens=tokens,
            entity_results=entity_service.get_entity_match_results(),
            entity_type_and_id_pairs=annotation_service.get_entities_to_annotate(),
            specified_organism=SpecifiedOrganismStrain(
                    synonym='', organism_id='', category='')
        )

    assert len(annotations) == 1
    assert 'guanosine' not in set([anno.keyword for anno in annotations])


def test_global_excluded_disease_annotations(
    default_lmdb_setup,
    mock_disease_exclusion,
    get_annotations_service,
    entity_service
):
    annotation_service = get_annotations_service
    pdf_parser = get_annotations_pdf_parser()
    entity_service = entity_service

    pdf = path.join(directory, f'pdf_samples/disease_exclusion.pdf')

    with open(pdf, 'rb') as f:
        pdf_text = pdf_parser.parse_pdf(pdf=f)
        tokens = pdf_parser.extract_tokens(parsed_chars=pdf_text)

        lookup_entities(entity_service=entity_service, tokens=tokens)
        annotations = annotation_service.create_rules_based_annotations(
            tokens=tokens,
            entity_results=entity_service.get_entity_match_results(),
            entity_type_and_id_pairs=annotation_service.get_entities_to_annotate(),
            specified_organism=SpecifiedOrganismStrain(
                    synonym='', organism_id='', category='')
        )

    assert len(annotations) == 2
    assert 'cold sore' not in set([anno.keyword for anno in annotations])
    assert 'Cold Sore' not in set([anno.keyword for anno in annotations])


def test_global_excluded_gene_annotations(
    default_lmdb_setup,
    mock_gene_exclusion,
    get_annotations_service,
    entity_service
):
    annotation_service = get_annotations_service
    pdf_parser = get_annotations_pdf_parser()
    entity_service = entity_service

    pdf = path.join(directory, f'pdf_samples/gene_exclusion.pdf')

    with open(pdf, 'rb') as f:
        pdf_text = pdf_parser.parse_pdf(pdf=f)
        tokens = pdf_parser.extract_tokens(parsed_chars=pdf_text)

        lookup_entities(entity_service=entity_service, tokens=tokens)
        annotations = annotation_service.create_rules_based_annotations(
            tokens=tokens,
            entity_results=entity_service.get_entity_match_results(),
            entity_type_and_id_pairs=annotation_service.get_entities_to_annotate(),
            specified_organism=SpecifiedOrganismStrain(
                    synonym='', organism_id='', category='')
        )

    assert len(annotations) == 2
    assert 'BOLA3' not in set([anno.keyword for anno in annotations])


def test_global_excluded_phenotype_annotations(
    default_lmdb_setup,
    mock_phenotype_exclusion,
    get_annotations_service,
    entity_service
):
    annotation_service = get_annotations_service
    pdf_parser = get_annotations_pdf_parser()
    entity_service = entity_service

    pdf = path.join(directory, f'pdf_samples/phenotype_exclusion.pdf')

    with open(pdf, 'rb') as f:
        pdf_text = pdf_parser.parse_pdf(pdf=f)
        tokens = pdf_parser.extract_tokens(parsed_chars=pdf_text)

        lookup_entities(entity_service=entity_service, tokens=tokens)
        annotations = annotation_service.create_rules_based_annotations(
            tokens=tokens,
            entity_results=entity_service.get_entity_match_results(),
            entity_type_and_id_pairs=annotation_service.get_entities_to_annotate(),
            specified_organism=SpecifiedOrganismStrain(
                    synonym='', organism_id='', category='')
        )

    assert len(annotations) == 2
    assert 'whey proteins' not in set([anno.keyword for anno in annotations])


def test_global_excluded_protein_annotations(
    default_lmdb_setup,
    mock_protein_exclusion,
    get_annotations_service,
    entity_service
):
    annotation_service = get_annotations_service
    pdf_parser = get_annotations_pdf_parser()
    entity_service = entity_service

    pdf = path.join(directory, f'pdf_samples/protein_exclusion.pdf')

    with open(pdf, 'rb') as f:
        pdf_text = pdf_parser.parse_pdf(pdf=f)
        tokens = pdf_parser.extract_tokens(parsed_chars=pdf_text)

        lookup_entities(entity_service=entity_service, tokens=tokens)
        annotations = annotation_service.create_rules_based_annotations(
            tokens=tokens,
            entity_results=entity_service.get_entity_match_results(),
            entity_type_and_id_pairs=annotation_service.get_entities_to_annotate(),
            specified_organism=SpecifiedOrganismStrain(
                    synonym='', organism_id='', category='')
        )

    assert len(annotations) == 2
    assert 'Wasabi receptor toxin' not in set([anno.keyword for anno in annotations])


def test_global_excluded_species_annotations(
    default_lmdb_setup,
    mock_species_exclusion,
    get_annotations_service,
    entity_service
):
    annotation_service = get_annotations_service
    pdf_parser = get_annotations_pdf_parser()
    entity_service = entity_service

    pdf = path.join(directory, f'pdf_samples/species_exclusion.pdf')

    with open(pdf, 'rb') as f:
        pdf_text = pdf_parser.parse_pdf(pdf=f)
        tokens = pdf_parser.extract_tokens(parsed_chars=pdf_text)

        lookup_entities(entity_service=entity_service, tokens=tokens)
        annotations = annotation_service.create_rules_based_annotations(
            tokens=tokens,
            entity_results=entity_service.get_entity_match_results(),
            entity_type_and_id_pairs=annotation_service.get_entities_to_annotate(),
            specified_organism=SpecifiedOrganismStrain(
                    synonym='', organism_id='', category='')
        )

    assert len(annotations) == 1
    assert annotations[0].keyword == 'rat'


@pytest.mark.parametrize(
    'index, mock_tokens',
    [
        (1, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='adenosine',
                    char_positions={
                        i: c for i, c in enumerate('adenosine')
                    },
                    normalized_keyword='adenosine'
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='rat',
                    char_positions={
                        i + len('adenosine') + 1: c for i, c in enumerate('rat')},  # noqa
                    normalized_keyword='rat'
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='dog',
                    char_positions={
                        i + len('adenosine') + len('rat') + 2: c for i, c in enumerate('dog')},  # noqa
                    normalized_keyword='dog'
                ),
        ]),
    ],
)
def test_global_excluded_annotations_does_not_interfere_with_other_entities(
    default_lmdb_setup,
    mock_global_chemical_exclusion,
    index,
    mock_tokens,
    get_annotations_service,
    entity_service
):
    annotation_service = get_annotations_service
    entity_service = entity_service

    char_coord_objs_in_pdf, word_index_dict = process_tokens(mock_tokens)

    tokens = PDFTokenPositionsList(
        token_positions=mock_tokens,
        char_coord_objs_in_pdf=char_coord_objs_in_pdf,
        cropbox_in_pdf=(5, 5),
        min_idx_in_page={0: 1},
        word_index_dict=word_index_dict
    )
    lookup_entities(entity_service=entity_service, tokens=tokens)
    annotations = annotation_service.create_rules_based_annotations(
        tokens=tokens,
        entity_results=entity_service.get_entity_match_results(),
        entity_type_and_id_pairs=annotation_service.get_entities_to_annotate(),
        specified_organism=SpecifiedOrganismStrain(
                synonym='', organism_id='', category='')
    )

    assert len(annotations) == 2
    assert mock_tokens[2].keyword not in set([anno.keyword for anno in annotations])
    assert annotations[0].keyword == 'adenosine'
    assert annotations[0].meta.type == EntityType.COMPOUND.value


@pytest.mark.parametrize(
    'index, mock_tokens',
    [
        (1, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='NS2A',
                    char_positions={
                        i: c for i, c in enumerate('NS2A')
                    },
                    normalized_keyword='ns2a'
                ),
        ]),
    ],
)
def test_lmdb_match_protein_by_exact_case_if_multiple_matches(
    default_lmdb_setup,
    index,
    mock_tokens,
    get_annotations_service,
    entity_service
):
    annotation_service = get_annotations_service
    entity_service = entity_service

    char_coord_objs_in_pdf, word_index_dict = process_tokens(mock_tokens)

    tokens = PDFTokenPositionsList(
        token_positions=mock_tokens,
        char_coord_objs_in_pdf=char_coord_objs_in_pdf,
        cropbox_in_pdf=(5, 5),
        min_idx_in_page={0: 1},
        word_index_dict=word_index_dict
    )
    lookup_entities(entity_service=entity_service, tokens=tokens)
    annotations = annotation_service.create_rules_based_annotations(
        tokens=tokens,
        entity_results=entity_service.get_entity_match_results(),
        entity_type_and_id_pairs=annotation_service.get_entities_to_annotate(),
        specified_organism=SpecifiedOrganismStrain(
                synonym='', organism_id='', category='')
    )

    assert len(annotations) == 1
    # both ns2a and NS2A are in LMDB
    assert annotations[0].keyword == 'NS2A'


@pytest.mark.parametrize(
    'index, mock_tokens',
    [
        (1, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='fake-chemical-(12345)',
                    char_positions={
                        i: c for i, c in enumerate('fake-chemical-(12345)')
                    },
                    normalized_keyword='fakechemical12345'
                ),
        ]),
    ],
)
def test_global_chemical_inclusion_annotation(
    default_lmdb_setup,
    mock_global_chemical_inclusion,
    index,
    mock_tokens,
    get_annotations_service,
    entity_service
):
    annotation_service = get_annotations_service
    entity_service = entity_service

    char_coord_objs_in_pdf, word_index_dict = process_tokens(mock_tokens)

    tokens = PDFTokenPositionsList(
        token_positions=mock_tokens,
        char_coord_objs_in_pdf=char_coord_objs_in_pdf,
        cropbox_in_pdf=(5, 5),
        min_idx_in_page={0: 1},
        word_index_dict=word_index_dict
    )
    lookup_entities(entity_service=entity_service, tokens=tokens)
    annotations = annotation_service.create_rules_based_annotations(
        tokens=tokens,
        entity_results=entity_service.get_entity_match_results(),
        entity_type_and_id_pairs=annotation_service.get_entities_to_annotate(),
        specified_organism=SpecifiedOrganismStrain(
                synonym='', organism_id='', category='')
    )

    assert len(annotations) == 1
    assert annotations[0].keyword == 'fake-chemical-(12345)'
    assert annotations[0].meta.id == 'CHEBI:Fake'


@pytest.mark.parametrize(
    'index, mock_tokens',
    [
        (1, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='compound-(12345)',
                    char_positions={
                        i: c for i, c in enumerate('compound-(12345)')
                    },
                    normalized_keyword='compound12345'
                ),
        ]),
    ],
)
def test_global_compound_inclusion_annotation(
    default_lmdb_setup,
    mock_global_compound_inclusion,
    index,
    mock_tokens,
    get_annotations_service,
    entity_service
):
    annotation_service = get_annotations_service
    entity_service = entity_service

    char_coord_objs_in_pdf, word_index_dict = process_tokens(mock_tokens)

    tokens = PDFTokenPositionsList(
        token_positions=mock_tokens,
        char_coord_objs_in_pdf=char_coord_objs_in_pdf,
        cropbox_in_pdf=(5, 5),
        min_idx_in_page={0: 1},
        word_index_dict=word_index_dict
    )
    lookup_entities(entity_service=entity_service, tokens=tokens)
    annotations = annotation_service.create_rules_based_annotations(
        tokens=tokens,
        entity_results=entity_service.get_entity_match_results(),
        entity_type_and_id_pairs=annotation_service.get_entities_to_annotate(),
        specified_organism=SpecifiedOrganismStrain(
                synonym='', organism_id='', category='')
    )

    assert len(annotations) == 1
    assert annotations[0].keyword == 'compound-(12345)'
    assert annotations[0].meta.id == 'BIOC:Fake'


@pytest.mark.parametrize(
    'index, mock_tokens',
    [
        (1, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='gene-(12345)',
                    char_positions={
                        i: c for i, c in enumerate('gene-(12345)')
                    },
                    normalized_keyword='gene12345'
                ),
                PDFTokenPositions(
                    page_number=1,
                    keyword='human',
                    char_positions={
                        i + len('gene-(12345)') + 1: c for i, c in enumerate('human')
                    },
                    normalized_keyword='human'
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
    mock_tokens,
    get_annotations_service,
    entity_service
):
    annotation_service = get_annotations_service
    entity_service = entity_service

    char_coord_objs_in_pdf, word_index_dict = process_tokens(mock_tokens)

    tokens = PDFTokenPositionsList(
        token_positions=mock_tokens,
        char_coord_objs_in_pdf=char_coord_objs_in_pdf,
        cropbox_in_pdf=(5, 5),
        min_idx_in_page={0: 1},
        word_index_dict=word_index_dict
    )
    lookup_entities(entity_service=entity_service, tokens=tokens)
    annotations = annotation_service.create_rules_based_annotations(
        tokens=tokens,
        entity_results=entity_service.get_entity_match_results(),
        entity_type_and_id_pairs=annotation_service.get_entities_to_annotate(),
        specified_organism=SpecifiedOrganismStrain(
                synonym='', organism_id='', category='')
    )

    assert len(annotations) == 2
    # new gene should be considered a synonym of
    # main gene with 59272 id (e.g ACE2)
    assert annotations[0].keyword == 'gene-(12345)'
    assert annotations[0].meta.id == '59272'


@pytest.mark.parametrize(
    'index, mock_tokens',
    [
        (1, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='disease-(12345)',
                    char_positions={
                        i: c for i, c in enumerate('disease-(12345)')
                    },
                    normalized_keyword='disease12345'
                ),
        ]),
    ],
)
def test_global_disease_inclusion_annotation(
    default_lmdb_setup,
    mock_global_disease_inclusion,
    index,
    mock_tokens,
    get_annotations_service,
    entity_service
):
    annotation_service = get_annotations_service
    entity_service = entity_service

    char_coord_objs_in_pdf, word_index_dict = process_tokens(mock_tokens)

    tokens = PDFTokenPositionsList(
        token_positions=mock_tokens,
        char_coord_objs_in_pdf=char_coord_objs_in_pdf,
        cropbox_in_pdf=(5, 5),
        min_idx_in_page={0: 1},
        word_index_dict=word_index_dict
    )
    lookup_entities(entity_service=entity_service, tokens=tokens)
    annotations = annotation_service.create_rules_based_annotations(
        tokens=tokens,
        entity_results=entity_service.get_entity_match_results(),
        entity_type_and_id_pairs=annotation_service.get_entities_to_annotate(),
        specified_organism=SpecifiedOrganismStrain(
                synonym='', organism_id='', category='')
    )

    assert len(annotations) == 1
    assert annotations[0].keyword == 'disease-(12345)'
    assert annotations[0].meta.id == 'Ncbi:Fake'


@pytest.mark.parametrize(
    'index, mock_tokens',
    [
        (1, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='phenotype-(12345)',
                    char_positions={
                        i: c for i, c in enumerate('phenotype-(12345)')
                    },
                    normalized_keyword='phenotype12345'
                ),
        ]),
    ],
)
def test_global_phenotype_inclusion_annotation(
    default_lmdb_setup,
    mock_global_phenotype_inclusion,
    index,
    mock_tokens,
    get_annotations_service,
    entity_service
):
    annotation_service = get_annotations_service
    entity_service = entity_service

    char_coord_objs_in_pdf, word_index_dict = process_tokens(mock_tokens)

    tokens = PDFTokenPositionsList(
        token_positions=mock_tokens,
        char_coord_objs_in_pdf=char_coord_objs_in_pdf,
        cropbox_in_pdf=(5, 5),
        min_idx_in_page={0: 1},
        word_index_dict=word_index_dict
    )
    lookup_entities(entity_service=entity_service, tokens=tokens)
    annotations = annotation_service.create_rules_based_annotations(
        tokens=tokens,
        entity_results=entity_service.get_entity_match_results(),
        entity_type_and_id_pairs=annotation_service.get_entities_to_annotate(),
        specified_organism=SpecifiedOrganismStrain(
                synonym='', organism_id='', category='')
    )

    assert len(annotations) == 1
    assert annotations[0].keyword == 'phenotype-(12345)'
    assert annotations[0].meta.id == 'Ncbi:Fake'


@pytest.mark.parametrize(
    'index, mock_tokens',
    [
        (1, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='protein-(12345)',
                    char_positions={
                        i: c for i, c in enumerate('protein-(12345)')
                    },
                    normalized_keyword='protein12345'
                ),
        ]),
    ],
)
def test_global_protein_inclusion_annotation(
    default_lmdb_setup,
    mock_global_protein_inclusion,
    index,
    mock_tokens,
    get_annotations_service,
    entity_service
):
    annotation_service = get_annotations_service
    entity_service = entity_service

    char_coord_objs_in_pdf, word_index_dict = process_tokens(mock_tokens)

    tokens = PDFTokenPositionsList(
        token_positions=mock_tokens,
        char_coord_objs_in_pdf=char_coord_objs_in_pdf,
        cropbox_in_pdf=(5, 5),
        min_idx_in_page={0: 1},
        word_index_dict=word_index_dict
    )
    lookup_entities(entity_service=entity_service, tokens=tokens)
    annotations = annotation_service.create_rules_based_annotations(
        tokens=tokens,
        entity_results=entity_service.get_entity_match_results(),
        entity_type_and_id_pairs=annotation_service.get_entities_to_annotate(),
        specified_organism=SpecifiedOrganismStrain(
                synonym='', organism_id='', category='')
    )

    assert len(annotations) == 1
    assert annotations[0].keyword == 'protein-(12345)'
    assert annotations[0].meta.id == 'protein-(12345)'


@pytest.mark.parametrize(
    'index, mock_tokens',
    [
        (1, [
                PDFTokenPositions(
                    page_number=1,
                    keyword='species-(12345)',
                    char_positions={
                        i: c for i, c in enumerate('species-(12345)')
                    },
                    normalized_keyword='species12345'
                ),
        ]),
    ],
)
def test_global_species_inclusion_annotation(
    default_lmdb_setup,
    mock_global_species_inclusion,
    index,
    mock_tokens,
    get_annotations_service,
    entity_service
):
    annotation_service = get_annotations_service
    entity_service = entity_service

    char_coord_objs_in_pdf, word_index_dict = process_tokens(mock_tokens)

    tokens = PDFTokenPositionsList(
        token_positions=mock_tokens,
        char_coord_objs_in_pdf=char_coord_objs_in_pdf,
        cropbox_in_pdf=(5, 5),
        min_idx_in_page={0: 1},
        word_index_dict=word_index_dict
    )
    lookup_entities(entity_service=entity_service, tokens=tokens)
    annotations = annotation_service.create_rules_based_annotations(
        tokens=tokens,
        entity_results=entity_service.get_entity_match_results(),
        entity_type_and_id_pairs=annotation_service.get_entities_to_annotate(),
        specified_organism=SpecifiedOrganismStrain(
                synonym='', organism_id='', category='')
    )

    assert len(annotations) == 1
    assert annotations[0].keyword == 'species-(12345)'
    assert annotations[0].meta.id == 'Ncbi:Fake'


@pytest.mark.skip(reason='Need to figure out how to mock service to return different values')
def test_primary_organism_strain(
    bola_human_monkey_gene,
    mock_get_gene_specified_strain,
    get_annotations_service,
    entity_service
):
    annotation_service = get_annotations_service
    pdf_parser = get_annotations_pdf_parser()
    entity_service = entity_service

    pdf = path.join(directory, f'pdf_samples/primary-organism-strain-bola3.pdf')

    annotations = []

    with open(pdf, 'rb') as f:
        pdf_text = pdf_parser.parse_pdf(pdf=f)
        tokens = pdf_parser.extract_tokens(parsed_chars=pdf_text)

        lookup_entities(entity_service=entity_service, tokens=tokens)
        annotations = annotation_service.create_rules_based_annotations(
            tokens=tokens,
            entity_results=entity_service.get_entity_match_results(),
            entity_type_and_id_pairs=annotation_service.get_entities_to_annotate(),
            specified_organism=SpecifiedOrganismStrain(
                synonym='', organism_id='', category='')
        )

    bola = [anno for anno in annotations if anno.keyword == 'BOLA3']
    assert bola[0].meta.id == '101099627'

    with open(pdf, 'rb') as f:
        pdf_text = pdf_parser.parse_pdf(pdf=f)
        tokens = pdf_parser.extract_tokens(parsed_chars=pdf_text)

        lookup_entities(entity_service=entity_service, tokens=tokens)
        annotations = annotation_service.create_rules_based_annotations(
            tokens=tokens,
            entity_results=entity_service.get_entity_match_results(),
            entity_type_and_id_pairs=annotation_service.get_entities_to_annotate(),
            specified_organism=SpecifiedOrganismStrain(
                synonym='Homo sapiens', organism_id='9606', category='Eukaryota')
        )

    bola = [anno for anno in annotations if anno.keyword == 'BOLA3']
    assert bola[0].meta.id == '388962'


def test_no_annotation_for_abbreviation(
    abbreviation_lmdb_setup,
    get_annotations_service,
    entity_service
):
    annotation_service = get_annotations_service
    pdf_parser = get_annotations_pdf_parser()
    entity_service = entity_service

    pdf = path.join(directory, f'pdf_samples/abbreviation-test.pdf')

    with open(pdf, 'rb') as f:
        pdf_text = pdf_parser.parse_pdf(pdf=f)
        tokens = pdf_parser.extract_tokens(parsed_chars=pdf_text)

        lookup_entities(entity_service=entity_service, tokens=tokens)
        annotations = annotation_service.create_rules_based_annotations(
            tokens=tokens,
            entity_results=entity_service.get_entity_match_results(),
            entity_type_and_id_pairs=annotation_service.get_entities_to_annotate(),
            specified_organism=SpecifiedOrganismStrain(
                    synonym='', organism_id='', category='')
        )

    assert len(annotations) == 2
    assert annotations[0].keyword == 'Pentose Phosphate Pathway'
    assert annotations[1].keyword == 'Pentose Phosphate Pathway'
