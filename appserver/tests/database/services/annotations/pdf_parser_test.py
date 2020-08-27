import pytest

from os import path

from neo4japp.database import get_annotations_pdf_parser
from neo4japp.data_transfer_objects import PDFParsedCharacters


# reference to this directory
directory = path.realpath(path.dirname(__file__))


@pytest.mark.parametrize(
    'index, text',
    [
        (1, PDFParsedCharacters(
            char_coord_objs_in_pdf=None,
            chars_in_pdf=[c for c in 'I am a sentence\n'],
            cropbox_in_pdf=(9, 9),
            min_idx_in_page={1: 1},
        )),
        (2, PDFParsedCharacters(
            char_coord_objs_in_pdf=None,
            chars_in_pdf=[c for c in 'E. \nColi'],
            cropbox_in_pdf=(9, 9),
            min_idx_in_page={1: 1},
        )),
        (3, PDFParsedCharacters(
            char_coord_objs_in_pdf=None,
            chars_in_pdf=[c for c in 'Typh-imurium'],
            cropbox_in_pdf=(9, 9),
            min_idx_in_page={1: 1},
        )),
        (4, PDFParsedCharacters(
            char_coord_objs_in_pdf=None,
            chars_in_pdf=[c for c in 'I Havecomma,'],
            cropbox_in_pdf=(9, 9),
            min_idx_in_page={1: 1},
        )),
        (5, PDFParsedCharacters(
            char_coord_objs_in_pdf=None,
            chars_in_pdf=[c for c in 'I Have)'],
            cropbox_in_pdf=(9, 9),
            min_idx_in_page={1: 1},
        )),
        (6, PDFParsedCharacters(
            char_coord_objs_in_pdf=None,
            chars_in_pdf=[c for c in 'I Have.'],
            cropbox_in_pdf=(9, 9),
            min_idx_in_page={1: 1},
        )),
        (7, PDFParsedCharacters(
            char_coord_objs_in_pdf=None,
            chars_in_pdf=[c for c in 'I Have.),'],
            cropbox_in_pdf=(9, 9),
            min_idx_in_page={1: 1},
        )),
        (8, PDFParsedCharacters(
            char_coord_objs_in_pdf=None,
            chars_in_pdf=[c for c in '(,I Have.),'],
            cropbox_in_pdf=(9, 9),
            min_idx_in_page={1: 1},
        )),
        (9, PDFParsedCharacters(
            char_coord_objs_in_pdf=None,
            chars_in_pdf=[c for c in '-*I Have- '],
            cropbox_in_pdf=(9, 9),
            min_idx_in_page={1: 1},
        )),
    ],
)
def test_extract_tokens(annotations_setup, index, text):
    pdf_parser = get_annotations_pdf_parser()
    parsed_tokens = pdf_parser.extract_tokens(parsed_chars=text)
    tokens = {t.keyword for t in parsed_tokens.token_positions}

    # NOTE: due to exclusion words/stop words
    # those will not be in the resulting tokens

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
            'E Coli',
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
    'index, chars',
    [
        (1, PDFParsedCharacters(
            char_coord_objs_in_pdf=None,
            chars_in_pdf=[c for c in 'I am a sentence\n'],
            cropbox_in_pdf=(9, 9),
            min_idx_in_page={1: 1},
        )),
        (2, PDFParsedCharacters(
            char_coord_objs_in_pdf=None,
            chars_in_pdf=[c for c in 'E. \nColi'],
            cropbox_in_pdf=(9, 9),
            min_idx_in_page={1: 1},
        )),
        (3, PDFParsedCharacters(
            char_coord_objs_in_pdf=None,
            chars_in_pdf=[c for c in 'Typh-imurium'],
            cropbox_in_pdf=(9, 9),
            min_idx_in_page={1: 1},
        )),
        (4, PDFParsedCharacters(
            char_coord_objs_in_pdf=None,
            chars_in_pdf=['Ti', '©', 'p', 'h', '-', 'i', 'm', 'u', 'r', 'i', 'u', 'm'],  # noqa
            cropbox_in_pdf=(9, 9),
            min_idx_in_page={1: 1},
        )),
        (5, PDFParsedCharacters(
            char_coord_objs_in_pdf=None,
            chars_in_pdf=[c for c in 'Just saying…'],
            cropbox_in_pdf=(9, 9),
            min_idx_in_page={1: 1},
        )),
        (6, PDFParsedCharacters(
            char_coord_objs_in_pdf=None,
            chars_in_pdf=[c for c in '3-geranyl-3-[(Z)-2-isocyanovinyl]-3H-indole'],
            cropbox_in_pdf=(9, 9),
            min_idx_in_page={1: 1},
        )),
    ],
)
def test_combine_char_into_word_with_correct_index_positions(annotations_setup, index, chars):
    pdf_parser = get_annotations_pdf_parser()
    words = pdf_parser.combine_chars_into_words(parsed_chars=chars)

    if index == 1:
        combined = [
            ('I', {0: 'I'}),
            ('am', {2: 'a', 3: 'm'}),
            ('a', {5: 'a'}),
            ('sentence', {
                7: 's', 8: 'e',
                9: 'n', 10: 't', 11: 'e', 12: 'n', 13: 'c', 14: 'e'}),
        ]
        assert combined == words
    elif index == 2:
        combined = [
            ('E', {0: 'E'}),
            ('Coli', {4: 'C', 5: 'o', 6: 'l', 7: 'i'}),
        ]
        assert combined == words
    elif index == 3:
        combined = [
            ('Typh-imurium', {
                0: 'T', 1: 'y',
                2: 'p', 3: 'h',
                4: '-', 5: 'i',
                6: 'm', 7: 'u', 8: 'r', 9: 'i', 10: 'u', 11: 'm'}),
        ]
        assert combined == words
    elif index == 4:
        combined = [
            ('ph-imurium', {
                2: 'p', 3: 'h',
                4: '-', 5: 'i',
                6: 'm', 7: 'u', 8: 'r', 9: 'i', 10: 'u', 11: 'm'}),
        ]
        assert combined == words
    elif index == 5:
        combined = [
            ('Just', {0: 'J', 1: 'u', 2: 's', 3: 't'}),
            ('saying…', {5: 's', 6: 'a', 7: 'y', 8: 'i', 9: 'n', 10: 'g', 11: '…'}),
        ]
        assert combined == words


@pytest.mark.parametrize(
    'index, chars',
    [
        (1, PDFParsedCharacters(
            char_coord_objs_in_pdf=None,
            chars_in_pdf=[c for c in '3-geranyl-3-[(Z)-2-isocyanovinyl]-3H-indole'],
            cropbox_in_pdf=(9, 9),
            min_idx_in_page={1: 1},
        )),
        (2, PDFParsedCharacters(
            char_coord_objs_in_pdf=None,
            chars_in_pdf=[c for c in '2,3-Benzopyrrole'],
            cropbox_in_pdf=(9, 9),
            min_idx_in_page={1: 1},
        )),
        (3, PDFParsedCharacters(
            char_coord_objs_in_pdf=None,
            chars_in_pdf=[c for c in '(Phosphonomethoxy)ethyl)adenine)'],
            cropbox_in_pdf=(9, 9),
            min_idx_in_page={1: 1},
        )),
        (4, PDFParsedCharacters(
            char_coord_objs_in_pdf=None,
            chars_in_pdf=[c for c in '(Phosphonomethoxy)ethyl)adenine'],
            cropbox_in_pdf=(9, 9),
            min_idx_in_page={1: 1},
        )),
        (5, PDFParsedCharacters(
            char_coord_objs_in_pdf=None,
            chars_in_pdf=[c for c in '(xylB)'],
            cropbox_in_pdf=(9, 9),
            min_idx_in_page={1: 1},
        )),
        (6, PDFParsedCharacters(
            char_coord_objs_in_pdf=None,
            chars_in_pdf=[c for c in '2,6-dioxopurine(xylB)'],
            cropbox_in_pdf=(9, 9),
            min_idx_in_page={1: 1},
        )),
        (7, PDFParsedCharacters(
            char_coord_objs_in_pdf=None,
            chars_in_pdf=[c for c in 'xylB)'],
            cropbox_in_pdf=(9, 9),
            min_idx_in_page={1: 1},
        )),
        (8, PDFParsedCharacters(
            char_coord_objs_in_pdf=None,
            chars_in_pdf=[c for c in '(xylB'],
            cropbox_in_pdf=(9, 9),
            min_idx_in_page={1: 1},
        )),
        (9, PDFParsedCharacters(
            char_coord_objs_in_pdf=None,
            chars_in_pdf=[c for c in '(xylB,'],
            cropbox_in_pdf=(9, 9),
            min_idx_in_page={1: 1},
        )),
        (10, PDFParsedCharacters(
            char_coord_objs_in_pdf=None,
            chars_in_pdf=[c for c in '2,6-dioxopurine?!'],
            cropbox_in_pdf=(9, 9),
            min_idx_in_page={1: 1},
        )),
    ],
)
def test_leading_trailing_punctuation_removed(annotations_setup, index, chars):
    pdf_parser = get_annotations_pdf_parser()
    words = pdf_parser.combine_chars_into_words(parsed_chars=chars)

    if index == 1:
        assert {'3-geranyl-3-[(Z)-2-isocyanovinyl]-3H-indole'} == set([w for w, _ in words])
    elif index == 2:
        assert {'2,3-Benzopyrrole'} == set([w for w, _ in words])
    elif index == 3:
        assert {'Phosphonomethoxy)ethyl)adenine'} == set([w for w, _ in words])
    elif index == 4:
        assert {'(Phosphonomethoxy)ethyl)adenine'} == set([w for w, _ in words])
    elif index == 5 or index == 7 or index == 8 or index == 9:
        assert {'xylB'} == set([w for w, _ in words])
    elif index == 6:
        assert {'2,6-dioxopurine(xylB)'} == set([w for w, _ in words])
    elif index == 10:
        assert {'2,6-dioxopurine'} == set([w for w, _ in words])


def test_expand_ligatures(annotations_setup):
    pdf_parser = get_annotations_pdf_parser()
    pdf = path.join(directory, 'pdf_samples/ligatures.pdf')
    parsed_pdf_chars = []

    with open(pdf, 'rb') as f:
        parsed_pdf_chars = pdf_parser.parse_pdf(pdf=f)

    # every character should have a LT object
    # ligatures should be expanded
    assert len(parsed_pdf_chars.char_coord_objs_in_pdf) == 59
