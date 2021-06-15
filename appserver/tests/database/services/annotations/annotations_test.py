import json
import pytest

from os import path
from typing import List, Tuple

from neo4japp.services.annotations.data_transfer_objects import (
    Annotation,
    GeneAnnotation,
    NLPResults,
    SpecifiedOrganismStrain
)
from neo4japp.services.annotations.constants import EntityType, OrganismCategory
from neo4japp.services.annotations.pipeline import read_parser_response


# reference to this directory
directory = path.realpath(path.dirname(__file__))


"""NOTE: IMPORTANT: Integrated pdfbox2

When testing annotations, the pdfparser container does not have a shared volume
with the appserver container - we could mount a shared volume, but this doesn't make
sense because it will only be used during test.

Let's avoid unexpected volume access.

So, instead of loading the PDFs, we need to first get the JSON (meaning calling the
pdfparser separately and saving that JSON file to the pdf_samples folder from now on.).

This also makes sense because appserver would only get back the JSON.

Doing it this way is a hassle, but it also decouples the annotation tests from the
file system schema, as that gets changed.
"""


def annotate_pdf(
    annotation_service,
    entity_service,
    parsed,
    custom_annotations=None,
    excluded_annotations=None,
    nlp_results=None,
    specified_organism=SpecifiedOrganismStrain(synonym='', organism_id='', category='')
):
    if custom_annotations is None:
        custom_annotations = []

    if excluded_annotations is None:
        excluded_annotations = []

    if nlp_results is None:
        nlp_results = NLPResults()

    entity_results = entity_service.identify(
        excluded_annotations=excluded_annotations,
        custom_annotations=custom_annotations,
        tokens=parsed,
        nlp_results=nlp_results
    )
    return annotation_service.create_annotations(
        custom_annotations=custom_annotations,
        entity_results=entity_results,
        entity_type_and_id_pairs=annotation_service.get_entities_to_annotate(),
        specified_organism=specified_organism
    )


def create_mock_entity_annotations(data: List[Tuple[str, str, int, int, str]]):
    kw, tid, lo, hi, kwtype = data
    return Annotation(
        page_number=1,
        keyword=kw,
        lo_location_offset=lo,
        hi_location_offset=hi,
        keyword_length=len(kw),
        text_in_document=tid,
        keywords=[''],
        rects=[[1, 2]],
        meta=Annotation.Meta(
            type=kwtype,
            id='',
            id_type='',
            id_hyperlink='',
            links=Annotation.Meta.Links(),
        ),
        uuid='',
    )


def create_mock_gene_annotations(data: List[Tuple[str, str, int, int, str]]):
    kw, tid, lo, hi, _ = data
    return GeneAnnotation(
        page_number=1,
        keyword=kw,
        lo_location_offset=lo,
        hi_location_offset=hi,
        keyword_length=len(kw),
        text_in_document=tid,
        keywords=[''],
        rects=[[1, 2]],
        meta=GeneAnnotation.GeneMeta(
            type=EntityType.GENE.value,
            id='',
            id_type='',
            id_hyperlink='',
            links=Annotation.Meta.Links(),
            category=OrganismCategory.EUKARYOTA.value,
        ),
        uuid='',
    )


def create_mock_annotations(data):
    mocks = []
    for d in data:
        if d[4] != EntityType.GENE.value:
            mocks.append(create_mock_entity_annotations(d))
        else:
            mocks.append(create_mock_gene_annotations(d))
    return mocks


@pytest.mark.parametrize(
    'index, annotations',
    [
        (1, [
            ('Test', 'Test', 5, 8, EntityType.GENE.value),
            ('Test a long word', 'Test a long word', 5, 20, EntityType.GENE.value)
        ]),
        (2, [
            ('word', 'word', 17, 20, EntityType.GENE.value)
        ]),
        # adjacent intervals
        (3, [
            ('word a', 'word', 17, 22, EntityType.CHEMICAL.value),
            ('a long word', 'a long word', 22, 32, EntityType.CHEMICAL.value)
        ])
    ],
)
def test_fix_conflicting_annotations_same_types(
    get_annotation_service,
    index,
    annotations
):
    annotation_service = get_annotation_service
    fixed = annotation_service.fix_conflicting_annotations(
        unified_annotations=create_mock_annotations(annotations),
    )

    if index == 1:
        assert len(fixed) == 1
        assert fixed[0].keyword == 'Test a long word'
        assert fixed[0].lo_location_offset == 5
        assert fixed[0].hi_location_offset == 20
        assert fixed[0].meta.type == EntityType.GENE.value
    elif index == 2:
        assert len(fixed) == 1
        assert fixed[0].keyword == 'word'
        assert fixed[0].lo_location_offset == 17
        assert fixed[0].hi_location_offset == 20
        assert fixed[0].meta.type == EntityType.GENE.value
    elif index == 3:
        # test adjacent intervals
        assert len(fixed) == 1
        assert fixed[0].keyword == 'a long word'
        assert fixed[0].lo_location_offset == 22
        assert fixed[0].hi_location_offset == 32
        assert fixed[0].meta.type == EntityType.CHEMICAL.value


@pytest.mark.parametrize(
    'index, annotations',
    [
        (1, [
            ('Test', 'test', 5, 8, EntityType.GENE.value),
            ('Test', 'test', 5, 20, EntityType.CHEMICAL.value)
        ]),
        (2, [
            ('Test', 'test', 35, 38, EntityType.GENE.value),
            ('Test a long word', 'word', 5, 20, EntityType.CHEMICAL.value),
        ]),
        (3, [
            ('word', 'word', 17, 20, EntityType.GENE.value),
            ('Test a long word', 'test a long word', 5, 20, EntityType.CHEMICAL.value)
        ]),
        (4, [
            ('word', 'word', 17, 20, EntityType.GENE.value),
            ('Test a long word', 'test a long word', 5, 20, EntityType.CHEMICAL.value),
            ('long word', 'long word', 55, 63, EntityType.CHEMICAL.value)
        ]),
        # adjacent intervals
        (5, [
            ('word a', 'word a', 17, 22, EntityType.GENE.value),
            ('a long word', 'a long word', 22, 32, EntityType.CHEMICAL.value)
        ]),
        (6, [
            ('IL7', 'IL-7', 5, 8, EntityType.GENE.value),
            ('IL-7', 'IL-7', 5, 8, EntityType.PROTEIN.value)
        ]),
        (7, [
            ('IL7', 'il-7', 5, 8, EntityType.GENE.value),
            ('IL-7', 'il-7', 5, 8, EntityType.PROTEIN.value)
        ]),
    ],
)
def test_fix_conflicting_annotations_different_types(
    get_annotation_service,
    index,
    annotations
):
    annotation_service = get_annotation_service
    fixed = annotation_service.fix_conflicting_annotations(
        unified_annotations=create_mock_annotations(annotations),
    )

    if index == 1:
        assert len(fixed) == 1
        assert fixed[0].keyword == 'Test'
        assert fixed[0].lo_location_offset == 5
        assert fixed[0].hi_location_offset == 8
        assert fixed[0].meta.type == EntityType.GENE.value
    elif index == 2:
        assert len(fixed) == 2
    elif index == 3:
        assert len(fixed) == 1
        assert fixed[0].keyword == 'word'
        assert fixed[0].lo_location_offset == 17
        assert fixed[0].hi_location_offset == 20
        assert fixed[0].meta.type == EntityType.GENE.value
    elif index == 4:
        assert len(fixed) == 2
        assert fixed[0].keyword == 'word'
        assert fixed[0].lo_location_offset == 17
        assert fixed[0].hi_location_offset == 20
        assert fixed[0].meta.type == EntityType.GENE.value
        assert fixed[1].keyword == 'long word'
        assert fixed[1].lo_location_offset == 55
        assert fixed[1].hi_location_offset == 63
        assert fixed[1].meta.type == EntityType.CHEMICAL.value
    elif index == 5:
        assert len(fixed) == 1
        assert fixed[0].keyword == 'word a'
        assert fixed[0].lo_location_offset == 17
        assert fixed[0].hi_location_offset == 22
        assert fixed[0].meta.type == EntityType.GENE.value
    elif index == 6:
        assert len(fixed) == 1
        assert fixed[0].keyword == 'IL-7'
        assert fixed[0].lo_location_offset == 5
        assert fixed[0].hi_location_offset == 8
        assert fixed[0].meta.type == EntityType.PROTEIN.value
    elif index == 7:
        assert len(fixed) == 1
        assert fixed[0].keyword == 'IL7'
        assert fixed[0].lo_location_offset == 5
        assert fixed[0].hi_location_offset == 8
        assert fixed[0].meta.type == EntityType.GENE.value


def test_gene_organism_escherichia_coli_pdf(
    gene_organism_escherichia_coli_pdf_lmdb_setup,
    mock_get_gene_to_organism_match_result_for_escherichia_coli_pdf,
    get_annotation_service,
    get_entity_service
):
    annotation_service = get_annotation_service
    entity_service = get_entity_service

    pdf = path.join(directory, 'pdf_samples/annotations_test/ecoli_gene_test.json')

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = read_parser_response(parsed)
    annotations = annotate_pdf(
        annotation_service=annotation_service,
        entity_service=entity_service,
        parsed=parsed
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
    get_annotation_service,
    get_entity_service
):
    annotation_service = get_annotation_service
    entity_service = get_entity_service

    pdf = path.join(directory, 'pdf_samples/annotations_test/ecoli_protein_test.json')

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = read_parser_response(parsed)
    annotations = annotate_pdf(
        annotation_service=annotation_service,
        entity_service=entity_service,
        parsed=parsed
    )

    keywords = {o.keyword: o.meta.id for o in annotations}

    assert 'YdhC' in keywords
    assert keywords['YdhC'] == 'UNIPROT:P37597'


def test_local_inclusion_organism_gene_crossmatch(
    default_lmdb_setup,
    mock_general_human_genes,
    get_annotation_service,
    get_entity_service
):
    annotation_service = get_annotation_service
    entity_service = get_entity_service

    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_local_inclusion_organism_gene_crossmatch.json')

    custom_annotation = {
        'meta': {
            'id': '9606',
            'type': 'Species',
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
        parsed = json.load(f)

    _, parsed = read_parser_response(parsed)
    annotations = annotate_pdf(
        annotation_service=annotation_service,
        entity_service=entity_service,
        parsed=parsed,
        custom_annotations=[custom_annotation]
    )

    assert len(annotations) == 1
    assert annotations[0].meta.id == 'NCBI:388962'  # human gene


def test_local_exclusion_organism_gene_crossmatch(
    default_lmdb_setup,
    get_annotation_service,
    get_entity_service
):
    annotation_service = get_annotation_service
    entity_service = get_entity_service

    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_local_exclusion_organism_gene_crossmatch.json')

    excluded_annotation = {
        'id': '37293',
        'text': 'aotus nancymaae',
        'type': 'Species',
        'rects': [
            [
                381.21680400799994,
                706.52786608,
                473.9653966747998,
                718.27682008
            ]
        ],
        'reason': 'Other',
        'comment': '',
        'user_id': 1,
        'pageNumber': 1,
        'idHyperlink': 'https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=37293',
        'exclusion_date': '2020-11-10 17:39:27.050845+00:00',
        'excludeGlobally': False,
        'isCaseInsensitive': True
    }

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = read_parser_response(parsed)
    annotations = annotate_pdf(
        annotation_service=annotation_service,
        entity_service=entity_service,
        parsed=parsed,
        excluded_annotations=[excluded_annotation]
    )

    assert len(annotations) == 0


def test_human_gene_pdf(
    human_gene_pdf_lmdb_setup,
    human_gene_pdf_gene_and_organism_network,
    mock_get_gene_to_organism_match_result_for_human_gene_pdf,
    get_annotation_service,
    get_entity_service
):
    annotation_service = get_annotation_service
    entity_service = get_entity_service

    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_human_gene_pdf.json')

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = read_parser_response(parsed)
    annotations = annotate_pdf(
        annotation_service=annotation_service,
        entity_service=entity_service,
        parsed=parsed
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
    get_annotation_service,
    get_entity_service
):
    annotation_service = get_annotation_service
    entity_service = get_entity_service

    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_foods_pdf.json')

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = read_parser_response(parsed)
    annotations = annotate_pdf(
        annotation_service=annotation_service,
        entity_service=entity_service,
        parsed=parsed
    )

    keywords = {o.keyword: o.meta.type for o in annotations}

    assert 'Artificial Sweeteners' in keywords
    assert keywords['Artificial Sweeteners'] == EntityType.FOOD.value

    assert 'Bacon' in keywords
    assert keywords['Bacon'] == EntityType.FOOD.value


def test_anatomy_pdf(
    anatomy_lmdb_setup,
    get_annotation_service,
    get_entity_service
):
    annotation_service = get_annotation_service
    entity_service = get_entity_service

    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_anatomy_pdf.json')

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = read_parser_response(parsed)
    annotations = annotate_pdf(
        annotation_service=annotation_service,
        entity_service=entity_service,
        parsed=parsed
    )

    keywords = {o.keyword: o.meta.type for o in annotations}

    assert '280 kDa Actin Binding Protein' in keywords
    assert keywords['280 kDa Actin Binding Protein'] == EntityType.ANATOMY.value

    assert 'Claws' in keywords
    assert keywords['Claws'] == EntityType.ANATOMY.value


@pytest.mark.parametrize(
    'index, fpath',
    [
        (1, 'pdf_samples/annotations_test/test_genes_vs_proteins/test_1.json'),
        (2, 'pdf_samples/annotations_test/test_genes_vs_proteins/test_2.json')
    ],
)
def test_genes_vs_proteins(
    default_lmdb_setup,
    mock_get_gene_to_organism_match_result,
    get_annotation_service,
    get_entity_service,
    index,
    fpath
):
    annotation_service = get_annotation_service
    entity_service = get_entity_service

    pdf = path.join(directory, fpath)

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = read_parser_response(parsed)
    annotations = annotate_pdf(
        annotation_service=annotation_service,
        entity_service=entity_service,
        parsed=parsed
    )

    if index == 1:
        assert len(annotations) == 4
        assert annotations[0].keyword == 'hyp27'
        assert annotations[0].meta.type == EntityType.GENE.value

        assert annotations[1].keyword == 'Moniliophthora roreri'
        assert annotations[1].meta.type == EntityType.SPECIES.value

        assert annotations[2].keyword == 'Hyp27'
        assert annotations[2].meta.type == EntityType.PROTEIN.value

        assert annotations[3].keyword == 'human'
        assert annotations[3].meta.type == EntityType.SPECIES.value
    elif index == 2:
        assert len(annotations) == 4
        assert annotations[0].keyword == 'Serpin A1'
        assert annotations[0].meta.type == EntityType.PROTEIN.value
        assert annotations[1].keyword == 'human'
        assert annotations[1].meta.type == EntityType.SPECIES.value
        assert annotations[2].keyword == 'SERPINA1'
        assert annotations[2].meta.type == EntityType.GENE.value
        assert annotations[3].keyword == 'human'
        assert annotations[3].meta.type == EntityType.SPECIES.value


@pytest.mark.parametrize(
    'index, annotations',
    [
        (1, [
            ('casE', 'case', 5, 8, EntityType.GENE.value),
        ]),
        (2, [
            ('ADD', 'add', 5, 7, EntityType.GENE.value),
        ]),
        (3, [
            ('CpxR', 'CpxR', 5, 7, EntityType.GENE.value),
        ])
    ],
)
def test_fix_false_positive_gene_annotations(
    get_annotation_service,
    index,
    annotations
):
    annotation_service = get_annotation_service
    fixed = annotation_service._get_fixed_false_positive_unified_annotations(
        annotations_list=create_mock_annotations(annotations),
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
            ('SidE', 'side', 5, 8, EntityType.PROTEIN.value),
        ]),
        (2, [
            ('Tir', 'TIR', 5, 7, EntityType.PROTEIN.value),
        ]),
        (3, [
            ('TraF', 'TraF', 5, 7, EntityType.PROTEIN.value),
        ]),
        (4, [
            ('NS2A', 'NS2A', 5, 8, EntityType.PROTEIN.value),
        ])
    ],
)
def test_fix_false_positive_protein_annotations(
    default_lmdb_setup,
    get_annotation_service,
    index,
    annotations
):
    annotation_service = get_annotation_service
    fixed = annotation_service._get_fixed_false_positive_unified_annotations(
        annotations_list=create_mock_annotations(annotations)
    )

    # do exact case matching for genes
    if index == 1:
        assert len(fixed) == 0
    elif index == 2:
        assert len(fixed) == 0
    elif index == 3:
        assert len(fixed) == 1
    elif index == 4:
        assert len(fixed) == 1
        # both ns2a and NS2A are in default_lmdb_setup
        assert fixed[0].keyword == 'NS2A'


def test_gene_annotation_crossmatch_human_fish(
    fish_gene_lmdb_setup,
    mock_gene_to_organism_crossmatch_human_fish,
    get_annotation_service,
    get_entity_service
):
    annotation_service = get_annotation_service
    entity_service = get_entity_service

    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_gene_annotation_crossmatch_human_fish.json')  # noqa

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = read_parser_response(parsed)
    annotations = annotate_pdf(
        annotation_service=annotation_service,
        entity_service=entity_service,
        parsed=parsed
    )

    # id should change to match KG
    # value from mock_gene_to_organism_crossmatch_human_fish
    assert annotations[0].meta.id == 'NCBI:99999'


def test_gene_annotation_crossmatch_human_rat(
    human_rat_gene_lmdb_setup,
    mock_gene_to_organism_crossmatch_human_rat,
    get_annotation_service,
    get_entity_service
):
    annotation_service = get_annotation_service
    entity_service = get_entity_service

    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_gene_annotation_crossmatch_human_rat.json')  # noqa

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = read_parser_response(parsed)
    annotations = annotate_pdf(
        annotation_service=annotation_service,
        entity_service=entity_service,
        parsed=parsed
    )

    for a in annotations:
        if a.text_in_document == 'EDEM3':
            # id should change to match KG
            # value from mock_gene_to_organism_crossmatch_human_rat
            assert annotations[1].meta.id == 'NCBI:80267'


def test_global_excluded_chemical_annotations(
    default_lmdb_setup,
    mock_global_chemical_exclusion,
    get_annotation_service,
    get_entity_service
):
    annotation_service = get_annotation_service
    entity_service = get_entity_service
    entity_service.excluded_chemicals = mock_global_chemical_exclusion

    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_global_excluded_chemical_annotations.json')  # noqa

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = read_parser_response(parsed)
    annotations = annotate_pdf(
        annotation_service=annotation_service,
        entity_service=entity_service,
        parsed=parsed
    )

    assert len(annotations) == 1
    assert 'hypofluorite' not in set([anno.keyword for anno in annotations])


def test_global_excluded_compound_annotations(
    default_lmdb_setup,
    mock_compound_exclusion,
    get_annotation_service,
    get_entity_service
):
    annotation_service = get_annotation_service
    entity_service = get_entity_service
    entity_service.excluded_compounds = mock_compound_exclusion

    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_global_excluded_compound_annotations.json')  # noqa

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = read_parser_response(parsed)
    annotations = annotate_pdf(
        annotation_service=annotation_service,
        entity_service=entity_service,
        parsed=parsed
    )

    assert len(annotations) == 1
    assert 'guanosine' not in set([anno.keyword for anno in annotations])


def test_global_excluded_disease_annotations(
    default_lmdb_setup,
    mock_disease_exclusion,
    get_annotation_service,
    get_entity_service
):
    annotation_service = get_annotation_service
    entity_service = get_entity_service
    entity_service.excluded_diseases = mock_disease_exclusion

    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_global_excluded_disease_annotations.json')  # noqa

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = read_parser_response(parsed)
    annotations = annotate_pdf(
        annotation_service=annotation_service,
        entity_service=entity_service,
        parsed=parsed
    )

    assert len(annotations) == 2
    assert 'cold sore' not in set([anno.keyword for anno in annotations])
    assert 'Cold Sore' not in set([anno.keyword for anno in annotations])


def test_global_excluded_gene_annotations(
    default_lmdb_setup,
    mock_gene_exclusion,
    get_annotation_service,
    get_entity_service
):
    annotation_service = get_annotation_service
    entity_service = get_entity_service
    entity_service.excluded_genes = mock_gene_exclusion

    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_global_excluded_gene_annotations.json')  # noqa

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = read_parser_response(parsed)
    annotations = annotate_pdf(
        annotation_service=annotation_service,
        entity_service=entity_service,
        parsed=parsed
    )

    assert len(annotations) == 2
    assert 'BOLA3' not in set([anno.keyword for anno in annotations])


def test_global_excluded_phenotype_annotations(
    default_lmdb_setup,
    mock_phenotype_exclusion,
    get_annotation_service,
    get_entity_service
):
    annotation_service = get_annotation_service
    entity_service = get_entity_service
    entity_service.excluded_phenotypes = mock_phenotype_exclusion

    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_global_excluded_phenotype_annotations.json')  # noqa

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = read_parser_response(parsed)
    annotations = annotate_pdf(
        annotation_service=annotation_service,
        entity_service=entity_service,
        parsed=parsed
    )

    assert len(annotations) == 2
    assert 'whey proteins' not in set([anno.keyword for anno in annotations])


def test_global_excluded_protein_annotations(
    default_lmdb_setup,
    mock_protein_exclusion,
    get_annotation_service,
    get_entity_service
):
    annotation_service = get_annotation_service
    entity_service = get_entity_service
    entity_service.excluded_proteins = mock_protein_exclusion

    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_global_excluded_protein_annotations.json')  # noqa

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = read_parser_response(parsed)
    annotations = annotate_pdf(
        annotation_service=annotation_service,
        entity_service=entity_service,
        parsed=parsed
    )

    assert len(annotations) == 2
    assert 'Wasabi receptor toxin' not in set([anno.keyword for anno in annotations])


def test_global_excluded_species_annotations(
    default_lmdb_setup,
    mock_species_exclusion,
    get_annotation_service,
    get_entity_service
):
    annotation_service = get_annotation_service
    entity_service = get_entity_service
    entity_service.excluded_species = mock_species_exclusion

    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_global_excluded_species_annotations.json')  # noqa

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = read_parser_response(parsed)
    annotations = annotate_pdf(
        annotation_service=annotation_service,
        entity_service=entity_service,
        parsed=parsed
    )

    assert len(annotations) == 1
    assert annotations[0].keyword == 'rat'


def test_global_exclusions_does_not_interfere_with_other_entities(
    default_lmdb_setup,
    mock_global_chemical_exclusion,
    get_annotation_service,
    get_entity_service
):
    annotation_service = get_annotation_service
    entity_service = get_entity_service
    entity_service.excluded_chemicals = mock_global_chemical_exclusion

    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_global_exclusions_does_not_interfere_with_other_entities.json')  # noqa

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = read_parser_response(parsed)
    annotations = annotate_pdf(
        annotation_service=annotation_service,
        entity_service=entity_service,
        parsed=parsed
    )

    # dog not in default_lmdb_setup
    assert len(annotations) == 2
    # adenosine was excluded as a CHEMICAL
    assert annotations[0].keyword == 'adenosine'
    assert annotations[0].meta.type == EntityType.COMPOUND.value


def test_global_chemical_inclusion_annotation(
    default_lmdb_setup,
    mock_global_chemical_inclusion,
    get_annotation_service,
    get_entity_service
):
    annotation_service = get_annotation_service
    entity_service = get_entity_service

    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_global_chemical_inclusion_annotation.json')  # noqa

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = read_parser_response(parsed)
    annotations = annotate_pdf(
        annotation_service=annotation_service,
        entity_service=entity_service,
        parsed=parsed
    )

    assert len(annotations) == 1
    assert annotations[0].keyword == 'fake-chemical-(12345)'
    assert annotations[0].meta.id == 'CHEBI:Fake'


def test_global_compound_inclusion_annotation(
    default_lmdb_setup,
    mock_global_compound_inclusion,
    get_annotation_service,
    get_entity_service
):
    annotation_service = get_annotation_service
    entity_service = get_entity_service

    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_global_compound_inclusion_annotation.json')  # noqa

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = read_parser_response(parsed)
    annotations = annotate_pdf(
        annotation_service=annotation_service,
        entity_service=entity_service,
        parsed=parsed
    )

    assert len(annotations) == 1
    assert annotations[0].keyword == 'compound-(12345)'
    assert annotations[0].meta.id == 'PUBCHEM:BIOC:Fake'


def test_global_gene_inclusion_annotation(
    default_lmdb_setup,
    human_gene_pdf_lmdb_setup,
    mock_global_gene_inclusion,
    mock_get_gene_ace2_for_global_gene_inclusion,
    mock_get_gene_to_organism_match_result_for_human_gene_pdf,
    get_annotation_service,
    get_entity_service
):
    annotation_service = get_annotation_service
    entity_service = get_entity_service

    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_global_gene_inclusion_annotation.json')  # noqa

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = read_parser_response(parsed)
    annotations = annotate_pdf(
        annotation_service=annotation_service,
        entity_service=entity_service,
        parsed=parsed
    )

    assert len(annotations) == 2
    # new gene should be considered a synonym of
    # main gene with 59272 id (e.g ACE2)
    assert annotations[0].keyword == 'gene-(12345)'
    assert annotations[0].meta.id == 'NCBI Gene:59272'


def test_global_disease_inclusion_annotation(
    default_lmdb_setup,
    mock_global_disease_inclusion,
    get_annotation_service,
    get_entity_service
):
    annotation_service = get_annotation_service
    entity_service = get_entity_service

    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_global_disease_inclusion_annotation.json')  # noqa

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = read_parser_response(parsed)
    annotations = annotate_pdf(
        annotation_service=annotation_service,
        entity_service=entity_service,
        parsed=parsed
    )

    assert len(annotations) == 1
    assert annotations[0].keyword == 'disease-(12345)'
    assert annotations[0].meta.id == 'MESH:Ncbi:Fake'


def test_global_phenomena_inclusion_annotation(
    default_lmdb_setup,
    mock_global_phenomena_inclusion,
    get_annotation_service,
    get_entity_service
):
    annotation_service = get_annotation_service
    entity_service = get_entity_service

    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_global_phenomena_inclusion_annotation.json')  # noqa

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = read_parser_response(parsed)
    annotations = annotate_pdf(
        annotation_service=annotation_service,
        entity_service=entity_service,
        parsed=parsed
    )

    assert len(annotations) == 1
    assert annotations[0].keyword == 'fake-phenomena'
    assert annotations[0].meta.id == 'MESH:Fake'


def test_global_phenotype_inclusion_annotation(
    default_lmdb_setup,
    mock_global_phenotype_inclusion,
    get_annotation_service,
    get_entity_service
):
    annotation_service = get_annotation_service
    entity_service = get_entity_service

    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_global_phenotype_inclusion_annotation.json')  # noqa

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = read_parser_response(parsed)
    annotations = annotate_pdf(
        annotation_service=annotation_service,
        entity_service=entity_service,
        parsed=parsed
    )

    assert len(annotations) == 1
    assert annotations[0].keyword == 'phenotype-(12345)'
    assert annotations[0].meta.id == 'CUSTOM:Fake'


def test_global_protein_inclusion_annotation(
    default_lmdb_setup,
    mock_global_protein_inclusion,
    get_annotation_service,
    get_entity_service
):
    annotation_service = get_annotation_service
    entity_service = get_entity_service

    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_global_protein_inclusion_annotation.json')  # noqa

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = read_parser_response(parsed)
    annotations = annotate_pdf(
        annotation_service=annotation_service,
        entity_service=entity_service,
        parsed=parsed
    )

    assert len(annotations) == 1
    assert annotations[0].keyword == 'protein-(12345)'
    assert annotations[0].meta.id == 'UNIPROT:protein-(12345)'


def test_global_species_inclusion_annotation(
    default_lmdb_setup,
    mock_global_species_inclusion,
    get_annotation_service,
    get_entity_service
):
    annotation_service = get_annotation_service
    entity_service = get_entity_service

    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_global_species_inclusion_annotation.json')  # noqa

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = read_parser_response(parsed)
    annotations = annotate_pdf(
        annotation_service=annotation_service,
        entity_service=entity_service,
        parsed=parsed
    )

    assert len(annotations) == 1
    assert annotations[0].keyword == 'species-(12345)'
    assert annotations[0].meta.id == 'NCBI Taxonomy:Ncbi:Fake'


@pytest.mark.skip(reason='Need to figure out how to mock service to return different values')
def test_primary_organism_strain(
    bola_human_monkey_gene,
    mock_get_gene_specified_strain,
    get_annotation_service,
    get_entity_service
):
    annotation_service = get_annotation_service
    entity_service = get_entity_service

    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_primary_organism_strain.json')

    annotations = []

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = read_parser_response(parsed)
    annotations = annotate_pdf(
        annotation_service=annotation_service,
        entity_service=entity_service,
        parsed=parsed
    )

    bola = [anno for anno in annotations if anno.keyword == 'BOLA3']
    assert bola[0].meta.id == '101099627'

    # annotate again but now with fallback organism
    annotations = annotate_pdf(
        annotation_service=annotation_service,
        entity_service=entity_service,
        parsed=parsed,
        specified_organism=SpecifiedOrganismStrain(
            synonym='Homo sapiens', organism_id='9606', category='Eukaryota')
    )

    bola = [anno for anno in annotations if anno.keyword == 'BOLA3']
    assert bola[0].meta.id == '388962'


def test_no_annotation_for_abbreviation(
    abbreviation_lmdb_setup,
    mock_gene_organism_abbrev_test,
    get_annotation_service,
    get_entity_service
):
    annotation_service = get_annotation_service
    entity_service = get_entity_service

    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_no_annotation_for_abbreviation.json')

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = read_parser_response(parsed)
    annotations = annotate_pdf(
        annotation_service=annotation_service,
        entity_service=entity_service,
        parsed=parsed,
        specified_organism=SpecifiedOrganismStrain(
            synonym='Homo sapiens',
            organism_id='9606',
            category='EUKARYOTA')
    )

    assert len(annotations) == 3
    keywords = {o.keyword: o.meta.type for o in annotations}
    assert 'PAH' not in keywords
    assert 'PPP' not in keywords
    assert 'Pentose Phosphate Pathway' in keywords
    assert 'Pulmonary Arterial Hypertension' in keywords


def test_delta_gene_deletion_detected(
    gene_organism_escherichia_coli_pdf_lmdb_setup,
    mock_get_gene_to_organism_match_result_for_escherichia_coli_pdf,
    get_annotation_service,
    get_entity_service
):
    annotation_service = get_annotation_service
    entity_service = get_entity_service

    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_delta_gene_deletion_detected.json')

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = read_parser_response(parsed)
    annotations = annotate_pdf(
        annotation_service=annotation_service,
        entity_service=entity_service,
        parsed=parsed
    )

    assert len(annotations) == 4
    assert annotations[0].keyword == 'purB'
    assert annotations[1].keyword == 'purC'
    assert annotations[2].keyword == 'purF'


def test_gene_primary_name(
    default_lmdb_setup,
    mock_get_gene_to_organism_match_result_for_gene_primary_name_pdf,
    get_annotation_service,
    get_entity_service
):
    annotation_service = get_annotation_service
    entity_service = get_entity_service

    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_gene_primary_name.json')

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = read_parser_response(parsed)
    annotations = annotate_pdf(
        annotation_service=annotation_service,
        entity_service=entity_service,
        parsed=parsed
    )

    assert len(annotations) == 2
    assert annotations[0].primary_name == 'PRKAB1'


def test_user_source_database_input_priority(
    mock_global_chemical_inclusion,
    get_annotation_service,
    get_entity_service
):
    custom = {
        'meta': {
            'idType': 'MESH',
            'allText': 'Carbon',
            'idHyperlink': 'http://fake',
            'isCaseInsensitive': True,
            'id': 'CHEBI:27594',
            'type': EntityType.CHEMICAL.value
        },
    }

    annotation_service = get_annotation_service
    entity_service = get_entity_service

    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_user_source_database_input_priority.json')

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = read_parser_response(parsed)
    annotations = annotate_pdf(
        annotation_service=annotation_service,
        entity_service=entity_service,
        parsed=parsed
    )

    # if idHyperlink in `mock_global_chemical_inclusion` was empty
    # then it would've defaulted to
    # https://www.ebi.ac.uk/chebi/searchId.do?chebiId=CHEBI:27594
    assert annotations[0].meta.id_hyperlink == custom['meta']['idHyperlink']
    assert annotations[0].meta.id_type == custom['meta']['idType']


def test_global_inclusion_normalized_already_in_lmdb(
    global_inclusion_normalized_already_in_lmdb_setup,
    mock_global_gene_inclusion,
    mock_gene_to_organism_il8_human_gene,
    mock_get_gene_IL8_CXCL8_for_global_gene_inclusion,
    get_annotation_service,
    get_entity_service
):
    annotation_service = get_annotation_service
    entity_service = get_entity_service

    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_global_inclusion_normalized_already_in_lmdb.json')  # noqa

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = read_parser_response(parsed)
    annotations = annotate_pdf(
        annotation_service=annotation_service,
        entity_service=entity_service,
        parsed=parsed
    )

    assert annotations[1].primary_name == 'CXCL8'


def test_gene_matched_to_organism_before_if_closest_is_too_far(
    gene_organism_matching_use_organism_before_lmdb_setup,
    mock_get_gene_to_organism_match_using_organism_before,
    get_annotation_service,
    get_entity_service
):
    annotation_service = get_annotation_service
    entity_service = get_entity_service

    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_gene_matched_to_organism_before_if_closest_is_too_far.json')  # noqa

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = read_parser_response(parsed)
    annotations = annotate_pdf(
        annotation_service=annotation_service,
        entity_service=entity_service,
        parsed=parsed
    )

    assert len(annotations) == 5

    matches = {a.keyword: a.meta.id for a in annotations}
    assert '5743' in matches['PTGS2']
    assert '627' in matches['BDNF']
    assert '684' in matches['BST2']


def test_gene_matched_to_most_freq_organism_if_closest_is_too_far_and_no_before_organism(
    gene_organism_matching_use_organism_before_lmdb_setup,
    mock_get_gene_to_organism_match_using_organism_before,
    get_annotation_service,
    get_entity_service
):
    annotation_service = get_annotation_service
    entity_service = get_entity_service

    pdf = path.join(
        directory,
        'pdf_samples/annotations_test/test_gene_matched_to_most_freq_organism_if_closest_is_too_far_and_no_before_organism.json')  # noqa

    with open(pdf, 'rb') as f:
        parsed = json.load(f)

    _, parsed = read_parser_response(parsed)
    annotations = annotate_pdf(
        annotation_service=annotation_service,
        entity_service=entity_service,
        parsed=parsed
    )

    assert len(annotations) == 8

    matches = {a.keyword: a.meta.id for a in annotations}
    assert '5743' in matches['PTGS2']
    assert '627' in matches['BDNF']
    assert '684' in matches['BST2']
