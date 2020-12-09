import pytest

from os import path

from neo4japp.database import get_annotation_pdf_parser
from neo4japp.services.annotations.data_transfer_objects import (
    PDFChar,
    PDFMeta,
    PDFWord,
    PDFParsedContent
)


# reference to this directory
directory = path.realpath(path.dirname(__file__))


def create_char_objs(parser, word):
    return [
        PDFChar(
            text=c,
            height=0.0,
            width=0.0,
            x0=0.0,
            y0=0.0,
            x1=0.0,
            y1=0.0,
            page_number=1,
            cropbox=(0, 0)
        ) for c in word
    ]


@pytest.mark.parametrize(
    'index, text',
    [
        (1, 'I am a sentence\n'),
        (2, 'E. \nColi'),
        (3, 'Typh-imurium'),
        (4, 'I Havecomma,'),
        (5, 'I Have)'),
        (6, 'I Have.'),
        (7, 'I Have.),'),
        (8, '(,I Have.),'),
        (9, '-*I Have- ')
    ],
)
def test_extract_tokens(annotations_setup, index, text, get_entity_service):
    pdf_parser = get_annotation_pdf_parser()
    tokens_list = get_entity_service.extract_tokens(
        parsed=PDFParsedContent(
            words=pdf_parser._combine_chars_into_words(
                create_char_objs(pdf_parser, text)
            )
        )
    )
    tokens = {t.keyword for t in tokens_list.tokens}

    if index == 1:
        verify = {
            'I am',
            'I am a',
            'I am a sentence',
            'am a',
            'am a sentence',
            'a sentence',
            'sentence',
        }
        assert verify == tokens
    elif index == 2:
        verify = {
            'E.',
            'E. Coli',
            'Coli',
        }
        assert verify == tokens
    elif index == 3:
        verify = {'Typh-imurium'}
        assert verify == tokens
    elif index == 4:
        verify = {'I Havecomma', 'Havecomma'}
        assert verify == tokens
    elif index == 5 or index == 6 or index == 7 or index == 8:
        verify = {'I Have'}
        assert verify == tokens
    elif index == 9:
        verify = {'*I', '*I Have'}
        assert verify == tokens


@pytest.mark.parametrize(
    'index, text',
    [
        (1, 'I am a sentence\n'),
        (2, 'E. \nColi'),
        (3, 'Typh-imurium'),
        (4, 'Ti©ph-imurium'),
        (5, 'Just saying…'),
        (6, '3-geranyl-3-[(Z)-2-isocyanovinyl]-3H-indole')
    ],
)
def test_combine_char_into_word_with_correct_index_positions(annotations_setup, index, text):
    pdf_parser = get_annotation_pdf_parser()
    words = pdf_parser._combine_chars_into_words(create_char_objs(pdf_parser, text))

    if index == 1:
        assert len(words) == 4

        # index of 'I'
        assert words[0].meta.lo_location_offset == 0
        assert words[0].meta.hi_location_offset == 0
        # index of 'am'
        assert words[1].meta.lo_location_offset == 2
        assert words[1].meta.hi_location_offset == 3
        # index of 'a'
        assert words[2].meta.lo_location_offset == 5
        assert words[2].meta.hi_location_offset == 5
        # index of 'sentence'
        assert words[3].meta.lo_location_offset == 7
        assert words[3].meta.hi_location_offset == 14
    elif index == 2:
        assert len(words) == 2

        # index of 'E.'
        assert words[0].meta.lo_location_offset == 0
        assert words[0].meta.hi_location_offset == 1
        # index of 'Coli'
        assert words[1].meta.lo_location_offset == 4
        assert words[1].meta.hi_location_offset == 7
    elif index == 3:
        assert len(words) == 1

        assert words[0].meta.lo_location_offset == 0
        assert words[0].meta.hi_location_offset == 11
    elif index == 4:
        assert len(words) == 1

        assert words[0].meta.lo_location_offset == 0
        assert words[0].meta.hi_location_offset == 12
    elif index == 5:
        assert len(words) == 2

        assert words[0].meta.lo_location_offset == 0
        assert words[0].meta.hi_location_offset == 3
        assert words[1].meta.lo_location_offset == 5
        assert words[1].meta.hi_location_offset == 11


@pytest.mark.parametrize(
    'index, text',
    [
        (1, '3-geranyl-3-[(Z)-2-isocyanovinyl]-3H-indole'),
        (2, '2,3-Benzopyrrole'),
        (3, '(Phosphonomethoxy)ethyl)adenine)'),
        (4, '(Phosphonomethoxy)ethyl)adenine'),
        (5, '(xylB)'),
        (6, '2,6-dioxopurine(xylB)'),
        (7, 'xylB)'),
        (8, '(xylB'),
        (9, '(xylB,'),
        (10, '2,6-dioxopurine?!')
    ],
)
def test_leading_trailing_punctuation_removed(annotations_setup, index, text):
    pdf_parser = get_annotation_pdf_parser()
    words = pdf_parser._combine_chars_into_words(
        create_char_objs(pdf_parser, text)
    )

    if index == 1:
        assert {'3-geranyl-3-[(Z)-2-isocyanovinyl]-3H-indole'} == set([w.keyword for w in words])
    elif index == 2:
        assert {'2,3-Benzopyrrole'} == set([w.keyword for w in words])
    elif index == 3:
        assert {'Phosphonomethoxy)ethyl)adenine'} == set([w.keyword for w in words])
    elif index == 4:
        assert {'(Phosphonomethoxy)ethyl)adenine'} == set([w.keyword for w in words])
    elif index == 5 or index == 7 or index == 8 or index == 9:
        assert {'xylB'} == set([w.keyword for w in words])
    elif index == 6:
        assert {'2,6-dioxopurine(xylB)'} == set([w.keyword for w in words])
    elif index == 10:
        assert {'2,6-dioxopurine'} == set([w.keyword for w in words])


def test_expand_ligatures(annotations_setup):
    pdf_parser = get_annotation_pdf_parser()
    pdf = path.join(
        directory,
        'pdf_samples/pdf_parser_test/test_expand_ligatures/ligatures.pdf')
    parsed = []

    with open(pdf, 'rb') as f:
        parsed = pdf_parser._parse_pdf_file(pdf=f)

    # every character should have a LT object
    # ligatures should be expanded
    assert len(parsed) == 59
