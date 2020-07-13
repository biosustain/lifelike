import pytest

from neo4japp.database import get_annotations_pdf_parser
from neo4japp.data_transfer_objects import PDFParsedCharacters


@pytest.mark.skip
@pytest.mark.parametrize(
    'index, text',
    [
        (1, PDFParsedCharacters(
            char_coord_objs_in_pdf=None,
            chars_in_pdf=['I', ' ', 'a', 'm', ' ', 'a', ' ', 's', 'e', 'n', 't', 'e', 'n', 'c', 'e', '\n'],  # noqa
            cropbox_in_pdf=(9, 9),
            min_idx_in_page={50: 1},
        )),
        (2, PDFParsedCharacters(
            char_coord_objs_in_pdf=None,
            chars_in_pdf=['E', '.', ' ', '\n', 'C', 'o', 'l', 'i'],
            cropbox_in_pdf=(9, 9),
            min_idx_in_page={50: 1},
        )),
        (3, PDFParsedCharacters(
            char_coord_objs_in_pdf=None,
            chars_in_pdf=['T', 'y', 'p', 'h', '-', 'i', 'm', 'u', 'r', 'i', 'u', 'm'],
            cropbox_in_pdf=(9, 9),
            min_idx_in_page={50: 1},
        )),
        (4, PDFParsedCharacters(
            char_coord_objs_in_pdf=None,
            chars_in_pdf=['I', ' ', 'H', 'a', 'v', 'e', 'c', 'o', 'm', 'm', 'a', ','],
            cropbox_in_pdf=(9, 9),
            min_idx_in_page={50: 1},
        )),
        (5, PDFParsedCharacters(
            char_coord_objs_in_pdf=None,
            chars_in_pdf=['I', ' ', 'H', 'a', 'v', 'e', ')'],
            cropbox_in_pdf=(9, 9),
            min_idx_in_page={50: 1},
        )),
        (6, PDFParsedCharacters(
            char_coord_objs_in_pdf=None,
            chars_in_pdf=['I', ' ', 'H', 'a', 'v', 'e', '.'],
            cropbox_in_pdf=(9, 9),
            min_idx_in_page={50: 1},
        )),
        (7, PDFParsedCharacters(
            char_coord_objs_in_pdf=None,
            chars_in_pdf=['I', ' ', 'H', 'a', 'v', 'e', '.', ')', ','],
            cropbox_in_pdf=(9, 9),
            min_idx_in_page={50: 1},
        )),
        (8, PDFParsedCharacters(
            char_coord_objs_in_pdf=None,
            chars_in_pdf=['(', ',', 'I', ' ', 'H', 'a', 'v', 'e', '.', ')', ','],
            cropbox_in_pdf=(9, 9),
            min_idx_in_page={50: 1},
        )),
        (9, PDFParsedCharacters(
            char_coord_objs_in_pdf=None,
            chars_in_pdf=['-', '*', 'I', ' ', 'H', 'a', 'v', 'e', '-', ' '],
            cropbox_in_pdf=(9, 9),
            min_idx_in_page={50: 1},
        )),
    ],
)
def test_extract_tokens(annotations_setup, index, text):
    pdf_parser = get_annotations_pdf_parser()
    parsed_tokens = pdf_parser.extract_tokens(parsed_chars=text)
    tokens = {t.keyword for t in parsed_tokens.token_positions}

    if index == 1:
        verify = {
            'I',
            'I am',
            'I am a',
            'I am a sentence',
            'am',
            'am a',
            'am a sentence',
            'a',
            'a sentence',
            'sentence',
        }
        assert verify == tokens
    elif index == 2:
        verify = {
            'E',
            'E. Coli',
            'Coli',
        }
        assert verify == tokens
    elif index == 3:
        verify = {'Typh-imurium'}
        assert verify == tokens
    elif index == 4:
        verify = {'I Havecomma', 'Havecomma', 'I'}
        assert verify == tokens
    elif index == 5 or index == 6 or index == 7 or index == 8 or index == 9:
        verify = {'I Have', 'Have', 'I'}
        assert verify == tokens


@pytest.mark.skip
@pytest.mark.parametrize(
    'index, chars',
    [
        (1, PDFParsedCharacters(
            char_coord_objs_in_pdf=None,
            chars_in_pdf=['I', ' ', 'a', 'm', ' ', 'a', ' ', 's', 'e', 'n', 't', 'e', 'n', 'c', 'e', '\n'],  # noqa
            cropbox_in_pdf=(9, 9),
            min_idx_in_page={50: 1},
        )),
        (2, PDFParsedCharacters(
            char_coord_objs_in_pdf=None,
            chars_in_pdf=['E', '.', ' ', '\n', 'C', 'o', 'l', 'i'],
            cropbox_in_pdf=(9, 9),
            min_idx_in_page={50: 1},
        )),
        (3, PDFParsedCharacters(
            char_coord_objs_in_pdf=None,
            chars_in_pdf=['T', 'y', 'p', 'h', '-', 'i', 'm', 'u', 'r', 'i', 'u', 'm'],  # noqa
            cropbox_in_pdf=(9, 9),
            min_idx_in_page={50: 1},
        )),
        (4, PDFParsedCharacters(
            char_coord_objs_in_pdf=None,
            chars_in_pdf=['Ti', '©', 'p', 'h', '-', 'i', 'm', 'u', 'r', 'i', 'u', 'm'],  # noqa
            cropbox_in_pdf=(9, 9),
            min_idx_in_page={50: 1},
        )),
        (5, PDFParsedCharacters(
            char_coord_objs_in_pdf=None,
            chars_in_pdf=['J', 'u', 's', 't', ' ', 's', 'a', 'y', 'i', 'n', 'g', '…'],  # noqa
            cropbox_in_pdf=(9, 9),
            min_idx_in_page={50: 1},
        )),
    ],
)
def test_combine_char_into_word(annotations_setup, index, chars):
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
            ('E.', {0: 'E', 1: '.'}),
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
