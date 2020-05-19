import json
import pytest

from os import path

from neo4japp.database import (
    get_annotations_service,
    get_bioc_document_service,
    get_annotations_pdf_parser,
    get_lmdb_dao,
)
from neo4japp.data_transfer_objects import (
    Annotation,
    PDFParsedCharacters
)
from neo4japp.models import Files
from neo4japp.services.annotations import AnnotationsService, LMDBDao
from neo4japp.services.annotations.constants import EntityType


# reference to this directory
directory = path.realpath(path.dirname(__file__))


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
                keywords=[''],
                rects=[[1, 2]],
                meta=Annotation.Meta(
                    keyword_type=EntityType.Genes.value,
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
                keywords=[''],
                rects=[[1, 2]],
                meta=Annotation.Meta(
                    keyword_type=EntityType.Genes.value,
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
                keywords=[''],
                rects=[[1, 2]],
                meta=Annotation.Meta(
                    keyword_type=EntityType.Genes.value,
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
                keywords=[''],
                rects=[[1, 2]],
                meta=Annotation.Meta(
                    keyword_type=EntityType.Chemicals.value,
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
                keywords=[''],
                rects=[[1, 2]],
                meta=Annotation.Meta(
                    keyword_type=EntityType.Genes.value,
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
                keywords=[''],
                rects=[[1, 2]],
                meta=Annotation.Meta(
                    keyword_type=EntityType.Chemicals.value,
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
                keywords=[''],
                rects=[[1, 2]],
                meta=Annotation.Meta(
                    keyword_type=EntityType.Genes.value,
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
                keywords=[''],
                rects=[[1, 2]],
                meta=Annotation.Meta(
                    keyword_type=EntityType.Chemicals.value,
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
                keywords=[''],
                rects=[[1, 2]],
                meta=Annotation.Meta(
                    keyword_type=EntityType.Genes.value,
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
                keywords=[''],
                rects=[[1, 2]],
                meta=Annotation.Meta(
                    keyword_type=EntityType.Genes.value,
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
                keywords=[''],
                rects=[[1, 2]],
                meta=Annotation.Meta(
                    keyword_type=EntityType.Chemicals.value,
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
                keywords=[''],
                rects=[[1, 2]],
                meta=Annotation.Meta(
                    keyword_type=EntityType.Chemicals.value,
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
                keywords=[''],
                rects=[[1, 2]],
                meta=Annotation.Meta(
                    keyword_type=EntityType.Genes.value,
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
                    keyword_type=EntityType.Chemicals.value,
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
                keywords=[''],
                rects=[[1, 2]],
                meta=Annotation.Meta(
                    keyword_type=EntityType.Chemicals.value,
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
                    keyword_type=EntityType.Chemicals.value,
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
    fixed = annotation_service.fix_conflicting_annotations(unified_annotations=annotations)

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


@pytest.mark.skip
@pytest.mark.parametrize(
    'file, expected_keywords',
    [
        (
            'example3.pdf',
            [
                'Ferredoxin',
                'lipoic acid',
                'Glutaredoxin',
                'Ferric chloride',
                'Human',
                'mitochondrial disease',
            ]
        ),
        (
            'example4.pdf',
            [
                'Amdinocillin',                 # Chemical
                'Escherichia coli',             # Organism
                'cysB',                         # Gene
                'ppGpp',                        # Compound
                'transcriptional regulator',    # Protein
                'strain'                        # Disease
            ]
        ),
    ],
)
def test_generate_annotations(
    annotations_setup,
    example4_pdf_gene_and_organism_network,
    file,
    expected_keywords,
):
    annotator = get_annotations_service()
    pdf_parser = get_annotations_pdf_parser()

    pdf = path.join(directory, f'pdf_samples/{file}')

    with open(pdf, 'rb') as f:
        pdf_text = pdf_parser.parse_pdf(pdf=f)
        annotations = annotator.create_annotations(
            tokens=pdf_parser.extract_tokens(parsed_chars=pdf_text))

    keywords = {o.keyword for o in annotations}

    assert all([
        (expected_keyword in keywords)
        for expected_keyword in expected_keywords]
    )


@pytest.mark.skip
def test_generate_bioc_annotations_format(annotations_setup):
    annotator = get_annotations_service()
    bioc_service = get_bioc_document_service()
    pdf_parser = get_annotations_pdf_parser()

    pdf = path.join(directory, 'pdf_samples/example3.pdf')

    with open(pdf, 'rb') as f:
        pdf_text = pdf_parser.parse_pdf(pdf=f)
        annotations = annotator.create_annotations(
            tokens=pdf_parser.extract_tokens(parsed_chars=pdf_text))

    bioc = bioc_service.read(
        parsed_chars=pdf_text,
        file_uri=path.join(directory, 'pdf_samples/example3.pdf'))
    annotations_json = bioc_service.generate_bioc_json(annotations=annotations, bioc=bioc)

    uri = annotations_json['documents'][0]['id']
    assert uri == path.join(directory, 'pdf_samples/example3.pdf')


@pytest.mark.skip
# NOTE: Use this test to debug/test until the PDF upload
# workflow is fully integrated
def test_save_bioc_annotations_to_db(annotations_setup, session):
    annotator = get_annotations_service(
        lmdb_dao=get_lmdb_dao()
    )
    bioc_service = get_bioc_document_service()
    pdf_parser = get_annotations_pdf_parser()

    pdf = path.join(directory, 'pdf_samples/Branched-Chain Amino Acid Metabolism.pdf')

    with open(pdf, 'rb') as f:
        parsed_pdf_chars = pdf_parser.parse_pdf(pdf=f)
        pdf_text = pdf_parser.parse_pdf_high_level(pdf=f)
        annotations = annotator.create_annotations(
            tokens=pdf_parser.extract_tokens(parsed_chars=parsed_pdf_chars))

    bioc = bioc_service.read(
        text=pdf_text,
        file_uri=path.join(directory, 'pdf_samples/Branched-Chain Amino Acid Metabolism.pdf'))
    annotations_json = bioc_service.generate_bioc_json(annotations=annotations, bioc=bioc)

    annotated_json_f = path.join(directory, 'pdf_samples/annotations-test.json')
    with open(annotated_json_f, 'w') as a_f:
        json.dump(annotations_json, a_f)

    with open(pdf, 'rb') as f:
        raw = f.read()
        pdf_file = Files(
            file_id='123',
            filename='filename',
            raw_file=raw,
            username='username',
            annotations=annotations_json,
            project=1,
        )

        session.add(pdf_file)
        session.commit()

    pdf_file_model = session.query(Files).first()
    assert pdf_file_model.filename == 'filename'
    assert pdf_file_model.file_id == '123'


@pytest.mark.skip
@pytest.mark.parametrize(
    'text',
    ['I really like coumarate, isobutyraldehyde, nucleotide and ethanol.' +
     ' But I don\'t really like glutarate or L-serine... valine',
     ],
)
def test_single_word_chebi_chemical_full_annotations(annotations_setup, text):
    annotator = get_annotations_service()
    pdf_parser = get_annotations_pdf_parser()

    annotations = annotator.create_annotations(
        tokens=pdf_parser.extract_tokens(parsed_chars=text))

    full_keywords = set([o['keyword'] for o in annotations])

    keywords = {
            'coumarate',
            'isobutyraldehyde',
            'nucleotide',
            'ethanol',
            'glutarate',
            'L-serine',
            'valine',
        }
    assert keywords.issubset(full_keywords)


@pytest.mark.skip
@pytest.mark.parametrize(
    'text',
    ['Cyclohexane was talking to pyridoxal just yesterday before meeting Metolachlor.' +
     ' 4-hydroxybenzaldehyde --- Artemisinin has Artemis in its name',
     ],
)
def test_single_word_compound_full_annotations(annotations_setup, text):
    annotator = get_annotations_service()
    pdf_parser = get_annotations_pdf_parser()

    annotations = annotator.create_annotations(
        tokens=pdf_parser.extract_tokens(parsed_chars=text))

    full_keywords = set([o['keyword'] for o in annotations])

    keywords = {
        'Cyclohexane',
        'pyridoxal',
        'Metolachlor',
        '4-hydroxybenzaldehyde',
        'Artemisinin',
    }
    assert keywords.issubset(full_keywords)


@pytest.mark.skip
@pytest.mark.parametrize(
    'text',
    ['Some proteins include: polymerase and ribosome.' +
     ' SucB-dihydrolipoate! Ribosome has the word some in it. Neat huh?\nBet you agree with that!',
     ],
)
def test_single_word_protein_full_annotations(annotations_setup, text):
    annotator = get_annotations_service()
    pdf_parser = get_annotations_pdf_parser()

    annotations = annotator.create_annotations(
        tokens=pdf_parser.extract_tokens(parsed_chars=text))

    full_keywords = set([o['keyword'] for o in annotations])

    keywords = {
        'polymerase',
        'ribosome',
        'SucB-dihydrolipoate',
        'Ribosome',
    }
    assert keywords.issubset(full_keywords)


@pytest.mark.skip
@pytest.mark.parametrize(
    'text',
    ['Soybeans can be used to make soy milk and tofu.' +
     ' Here are some species that are one word: Bacteriophage, S. cerevisiae and of course Human!',
     ],
)
def test_single_word_species_full_annotations(annotations_setup, text):
    annotator = get_annotations_service()
    pdf_parser = get_annotations_pdf_parser()

    annotations = annotator.create_annotations(
        tokens=pdf_parser.extract_tokens(parsed_chars=text))

    full_keywords = set([o['keyword'] for o in annotations])

    keywords = {
        'Soybeans',
        'Bacteriophage',
        'S. cerevisiae',
        'Human',
    }
    assert keywords.issubset(full_keywords)


@pytest.mark.skip
@pytest.mark.parametrize(
    'text',
    ['The disease Spondylosis is related to disks in the spine.' +
     ' Meningism, is a syndrome characterized by headaches, neck stiffness and so on;;....' +
     ' etc... Gagging, is triggered by touching the roof of your mouth!',
     ],
)
def test_single_word_diseases_full_annotations(annotations_setup, text):
    annotator = get_annotations_service()
    pdf_parser = get_annotations_pdf_parser()

    annotations = annotator.create_annotations(
        tokens=pdf_parser.extract_tokens(parsed_chars=text))

    full_keywords = set([o['keyword'] for o in annotations])

    keywords = {
        'disease',
        'Spondylosis',
        'spine',
        'Meningism',
        'Gagging',
    }
    assert keywords.issubset(full_keywords)


@pytest.mark.skip
@pytest.mark.parametrize(
    'text',
    ['Histidine methyl ester is an irreversible inhibitor for histidine decarboxylase.' +
     ' HC Blue No. 2 is a dark blue microcrystalline powder.' +
     ' peptidyl-threonine',
     ],
)
def test_multi_word_chebi_chemical_full_annotations(annotations_setup, text):
    annotator = get_annotations_service()
    pdf_parser = get_annotations_pdf_parser()

    annotations = annotator.create_annotations(
        tokens=pdf_parser.extract_tokens(parsed_chars=text))

    full_keywords = set([o['keyword'] for o in annotations])

    keywords = {
        'Histidine methyl ester',
        'histidine',
        'Histidine',
        'methyl ester',
        'ester',
        'inhibitor',
        'methyl',
        'HC Blue No. 2',
        'peptidyl-threonine',
    }
    assert keywords.issubset(full_keywords)


@pytest.mark.skip
@pytest.mark.parametrize(
    'text',
    ['But, in should not map to an existing compound.' +
     ' Artemisinic alcohol has the word Artemis in it.' +
     ' 1,3-propanediol',
     ],
)
def test_multi_word_compound_full_annotations(annotations_setup, text):
    annotator = get_annotations_service()
    pdf_parser = get_annotations_pdf_parser()

    annotations = annotator.create_annotations(
        tokens=pdf_parser.extract_tokens(parsed_chars=text))

    full_keywords = set([o['keyword'] for o in annotations])

    keywords = {
        'Artemisinic alcohol',
        'alcohol',
        '1,3-propanediol',
    }
    assert keywords.issubset(full_keywords)


@pytest.mark.skip
@pytest.mark.parametrize(
    'text',
    ['. Glutathione peroxidase help catalyzes the reduction of ' +
     'hydrogen peroxide to water and oxygen. ' +
     '- protein synthesis, is a biological process inside cells.' +
     ' B12-dependent glycerol dehydratase',
     ],
)
def test_multi_word_protein_full_annotations(annotations_setup, text):
    annotator = get_annotations_service()
    pdf_parser = get_annotations_pdf_parser()

    annotations = annotator.create_annotations(
        tokens=pdf_parser.extract_tokens(parsed_chars=text))

    full_keywords = set([o['keyword'] for o in annotations])

    keywords = {
        'Glutathione peroxidase',
        'peroxidase',
        'protein synthesis',
        'B12-dependent glycerol dehydratase',
    }
    assert keywords.issubset(full_keywords)


@pytest.mark.skip
@pytest.mark.parametrize(
    'text',
    ['At this rate, Salmonella  enterica, can be transmitted through food and water  .' +
     ' Escherichia coli lives in the intestines. E coli can be good and bad;' +
     ' Some strains of E.   coli help with digestion!',
     ],
)
def test_multi_word_species_full_annotations(annotations_setup, text):
    annotator = get_annotations_service()
    pdf_parser = get_annotations_pdf_parser()

    annotations = annotator.create_annotations(
        tokens=pdf_parser.extract_tokens(parsed_chars=text))

    full_keywords = set([o['keyword'] for o in annotations])

    keywords = {
        'Salmonella  enterica',
        'Escherichia coli',
        'E coli',
        'E.   coli',
    }
    assert keywords.issubset(full_keywords)


@pytest.mark.skip
@pytest.mark.parametrize(
    'text',
    ['The disease Spondylosis is related to intervertebral disks.' +
     ' Meningism, is a syndrome characterized by headaches, neck stiffness and so on;;....' +
     ' Pharyngeal Reflex - a synonym for gagging. Triggered by touching roof of mouth!',
     ],
)
def test_multi_word_diseases_full_annotations(annotations_setup, text):
    annotator = get_annotations_service()
    pdf_parser = get_annotations_pdf_parser()

    annotations = annotator.create_annotations(
        tokens=pdf_parser.extract_tokens(parsed_chars=text))

    full_keywords = set([o['keyword'] for o in annotations])

    keywords = {
        'disease',
        'Spondylosis',
        'intervertebral disks',
        'Meningism',
        'Pharyngeal Reflex',
        'Reflex',
        'gagging',
    }
    assert keywords.issubset(full_keywords)


@pytest.mark.skip
@pytest.mark.parametrize(
    'text',
    ['At this rate, Salmonella  enterica, can be transmitted through food and water  .\n' +
     'The disease Spondylosis is related to intervertebral disks.' +
     ' Artemisinic alcohol has the word Artemis in it;' +
     ' Some strains of E.   coli help with digestion!\nRibosome is one of many proteins..' +
     ' Escherichia coli (E. coli for short)',
     ],
)
def test_correct_annotated_entity_recognition(annotations_setup, text):
    annotator = get_annotations_service()
    pdf_parser = get_annotations_pdf_parser()

    annotations = annotator.create_annotations(
        tokens=pdf_parser.extract_tokens(parsed_chars=text))

    chemical_keywords = {o['keyword']: o['id'] for o in annotations if o['type'] == 'Chemicals'}
    compound_keywords = {o['keyword']: o['id'] for o in annotations if o['type'] == 'Compounds'}
    genes_keywords = {o['keyword']: o['id'] for o in annotations if o['type'] == 'Genes'}
    protein_keywords = {o['keyword']: o['id'] for o in annotations if o['type'] == 'Proteins'}
    species_keywords = {o['keyword']: o['id'] for o in annotations if o['type'] == 'Species'}
    diseases_keywords = {o['keyword']: o['id'] for o in annotations if o['type'] == 'Diseases'}

    assert len(chemical_keywords) == 6
    assert len(compound_keywords) == 3
    assert len(genes_keywords) == 4
    assert len(protein_keywords) == 1
    assert len(species_keywords) == 4
    assert len(diseases_keywords) == 4

    assert chemical_keywords['water'] == 'CHEBI:15377'
    assert chemical_keywords['food'] == 'CHEBI:33290'
    assert chemical_keywords['Artemisinic alcohol'] == 'CHEBI:64783'
    assert chemical_keywords['alcohol'] == 'CHEBI:30879'
    assert chemical_keywords['proteins'] == 'CHEBI:36080'
    assert chemical_keywords['one'] == 'CHEBI:58972'

    assert compound_keywords['water'] == 'WATER'
    assert compound_keywords['Artemisinic alcohol'] == 'CPD-7556'
    assert compound_keywords['alcohol'] == 'ETOH'

    assert genes_keywords['Artemis'] == '100579542'

    assert protein_keywords['Ribosome'] == 'CPLX0-3964'

    assert species_keywords['Salmonella  enterica'] == '28901'
    assert species_keywords['E.   coli'] == '562'
    assert species_keywords['Escherichia coli'] == '562'
    assert species_keywords['E. coli'] == '562'

    assert diseases_keywords['disease'] == 'MESH:D004194'
    assert diseases_keywords['Spondylosis'] == 'MESH:D055009'
    assert diseases_keywords['intervertebral disks'] == 'MESH:D055959'
    assert diseases_keywords['strains'] == 'MESH:D013180'


@pytest.mark.skip
@pytest.mark.parametrize('text', ['Escherichia coli (E. coli for short)  3   \n\n'])
def test_can_exit_sequential_walking_loop(annotations_setup, text):
    """Only increases the sequential count if the
    word is not in existing set, so it's possible to enter an infinite loop.

    E.g
        'short) 3' gets inserted and sequential count goes to 3
        'short) 3 ' doesn't get inserted and stripped of trailing whitespace
        'short) 3  ' repeats
    """
    annotator = get_annotations_service()
    pdf_parser = get_annotations_pdf_parser()

    annotations = annotator.create_annotations(
        tokens=pdf_parser.extract_tokens(parsed_chars=text))

    species_keywords = {o['keyword']: o['id'] for o in annotations if o['type'] == 'Species'}
    assert len(species_keywords) == 2


@pytest.mark.skip
@pytest.mark.parametrize(
    'text', ['headaches is a term used alternatively by multiple common names not included'])
def test_can_drop_synonym_annotations_if_common_names_not_used(annotations_setup, text):
    annotator = get_annotations_service()
    pdf_parser = get_annotations_pdf_parser()

    annotations = annotator.create_annotations(
        tokens=pdf_parser.extract_tokens(parsed_chars=text))

    diseases_keywords = set([o['keyword'] for o in annotations if o['type'] == 'Diseases'])
    assert len(diseases_keywords) == 0


@pytest.mark.skip
@pytest.mark.parametrize('text', ['dihydrogen is a common name for hydrogen'])
def test_can_annotate_synonym_if_one_of_common_names_is_used(annotations_setup, text):
    annotator = get_annotations_service()
    pdf_parser = get_annotations_pdf_parser()

    annotations = annotator.create_annotations(
        tokens=pdf_parser.extract_tokens(parsed_chars=text))

    chemical_keywords = set([o['keyword'] for o in annotations if o['type'] == 'Chemicals'])
    keywords = {'dihydrogen', 'hydrogen', 'name'}
    assert keywords == chemical_keywords


@pytest.mark.skip
@pytest.mark.parametrize('text', ['dihydrogen and hydrogen atom are a common names for hydrogen'])
def test_can_drop_synonym_annotations_if_multiple_common_names_is_used(annotations_setup, text):
    annotator = get_annotations_service()
    pdf_parser = get_annotations_pdf_parser()

    annotations = annotator.create_annotations(
        tokens=pdf_parser.extract_tokens(parsed_chars=text))

    chemical_keywords = set([o['keyword'] for o in annotations if o['type'] == 'Chemicals'])
    keywords = {'dihydrogen', 'hydrogen atom', 'atom'}
    assert keywords == chemical_keywords
