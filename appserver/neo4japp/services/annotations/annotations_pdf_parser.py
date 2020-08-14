import attr
import json
import re

from copy import deepcopy
from string import ascii_letters, digits, punctuation, whitespace
from typing import Any, Dict, List, Set, Tuple, Union

from pdfminer import high_level
from pdfminer.converter import PDFPageAggregator, TextConverter
from pdfminer.layout import LAParams, LTAnno, LTChar, LTTextBox, LTTextLine, LTFigure
from pdfminer.pdfdocument import PDFDocument
from pdfminer.pdfinterp import PDFResourceManager, PDFPageInterpreter
from pdfminer.pdfpage import PDFPage
from pdfminer.pdfparser import PDFParser

from neo4japp.data_transfer_objects import (
    PDFParsedCharacters,
    PDFTokenPositions,
    PDFTokenPositionsList,
)
from neo4japp.exceptions import AnnotationError

from .constants import (
    COMMON_WORDS,
    LIGATURES,
    MISC_SYMBOLS_AND_CHARS,
    PDF_CHARACTER_SPACING_THRESHOLD,
    PDF_NEW_LINE_THRESHOLD,
)
from .util import clean_char


class AnnotationsPDFParser:
    def __init__(self) -> None:
        # TODO: go into constants.py if used by other classes
        self.max_word_length = 6

    def _get_lt_char(
        self,
        layout: Any,
        char_coord_objs_in_pdf: List[Union[LTChar, LTAnno]],
        compiled_regex: re.Pattern,
    ) -> None:
        def space_exists_between_lt_chars(a: LTChar, b: LTChar):
            """Determines if a space character exists between two LTChars."""
            return (
                (b.x0 - a.x1 > a.width * PDF_CHARACTER_SPACING_THRESHOLD) or
                (abs(b.y0 - a.y0) > a.height * PDF_NEW_LINE_THRESHOLD)
            )

        def should_add_virtual_space(
            prev_char: Union[LTAnno, LTChar],
            curr_char: Union[LTAnno, LTChar]
        ):
            return (
                isinstance(prev_char, LTChar) and self._not_whitespace(char=prev_char.get_text()) and  # noqa
                isinstance(curr_char, LTChar) and self._not_whitespace(char=curr_char.get_text()) and  # noqa
                space_exists_between_lt_chars(prev_char, curr_char)
            )

        def expand_ligatures(ligature_str: str):
            ligatures_list: List[Union[LTChar, LTAnno]] = []
            ligature_str_len = len(ligature_str)

            original_lig_end_x = lt_obj.x1

            if ligature_str_len == 2:
                # for two characters ligatures
                lt_obj.set_bbox(
                    (
                        lt_obj.x0,
                        lt_obj.y0,
                        lt_obj.x0 + lt_obj.width/2 - 0.01,
                        lt_obj.y1,
                    ),
                )
                lt_obj._text = ligature_str[0]

                lt_obj_cp = deepcopy(lt_obj)
                lt_obj_cp.set_bbox(
                    (
                        lt_obj.x0 + lt_obj.width/2 + 0.01,
                        lt_obj.y0,
                        original_lig_end_x,
                        lt_obj.y1,
                    ),
                )
                lt_obj_cp._text = ligature_str[1]
                ligatures_list.append(lt_obj_cp)
            elif ligature_str_len == 3:
                # for three characters ligatures
                lt_obj.set_bbox(
                    (
                        lt_obj.x0,
                        lt_obj.y0,
                        lt_obj.x0 + lt_obj.width/3 - 0.01,
                        lt_obj.y1,
                    ),
                )
                lt_obj._text = ligature_str[0]

                # second char in ligature
                lt_obj_c2 = deepcopy(lt_obj)
                lt_obj_c2.set_bbox(
                    (
                        lt_obj.x0 + lt_obj.width/3 + 0.01,
                        lt_obj.y0,
                        lt_obj.x0 + 2 * lt_obj.width/3 - 0.01,
                        lt_obj.y1,
                    ),
                )
                lt_obj_c2._text = ligature_str[1]
                ligatures_list.append(lt_obj_c2)

                # third char in ligature
                lt_obj_c3 = deepcopy(lt_obj)
                lt_obj_c3.set_bbox(
                    (
                        lt_obj.x0 + 2 * lt_obj.width/3 + 0.01,
                        lt_obj.y0,
                        original_lig_end_x,
                        lt_obj.y1,
                    ),
                )
                lt_obj_c3._text = ligature_str[-1]
                ligatures_list.append(lt_obj_c3)
            return ligatures_list

        for lt_obj in layout:
            if isinstance(lt_obj, LTTextBox) or isinstance(lt_obj, LTTextLine) or isinstance(lt_obj, LTFigure):  # noqa
                self._get_lt_char(
                    layout=lt_obj,
                    char_coord_objs_in_pdf=char_coord_objs_in_pdf,
                    compiled_regex=compiled_regex,
                )
            elif isinstance(lt_obj, LTChar) or (isinstance(lt_obj, LTAnno) and lt_obj.get_text() != '\n'):  # noqa
                lt_obj_text = lt_obj.get_text()
                # ignore CID fonts
                # these are arithmetic or other symbols the parser
                # was not able to translate
                # usually requires a license or better algorithm from parser
                if not re.search(compiled_regex, lt_obj_text):
                    ligatures_list: List[LTChar] = []
                    char_unicode = None

                    try:
                        char_unicode = ord(lt_obj_text)
                    except Exception:
                        # pdfminer sometimes parses ligatures as actually two chars
                        # in one LTChar object
                        ligatures_list.extend(expand_ligatures(lt_obj_text))

                    # first check for ligatures, e.g `fi`, `ffi`, etc
                    # the ligatures are one char, so need to expand them
                    # essentially creating new chars for each supposed chars
                    # in the ligature
                    if char_unicode:
                        if char_unicode in LIGATURES:
                            decoded_str = LIGATURES[char_unicode]
                            ligatures_list.extend(expand_ligatures(decoded_str))

                    if char_coord_objs_in_pdf:
                        prev_char = char_coord_objs_in_pdf[-1]

                        if should_add_virtual_space(prev_char, lt_obj):
                            virtual_space_char = LTAnno(' ')
                            char_coord_objs_in_pdf.append(virtual_space_char)
                        # only append if previous is not a whitespace
                        if self._not_whitespace(char=prev_char.get_text()) and self._not_whitespace(char=lt_obj.get_text()):  # noqa
                            char_coord_objs_in_pdf.append(lt_obj)
                    else:
                        char_coord_objs_in_pdf.append(lt_obj)
                    if ligatures_list:
                        char_coord_objs_in_pdf.extend(ligatures_list)

    def parse_pdf_high_level(self, pdf) -> str:
        return high_level.extract_text(pdf)

    def parse_pubtator(self, pubtator) -> PDFParsedCharacters:
        """Parse a Pubtator file and produces similar results to
        self.parse_pdf(). The only difference would be the LTChar
        objects will not actual PDF coordinates.
        """
        @attr.s(frozen=True)
        class Font():
            fontname: str = attr.ib()

            def is_vertical(self):
                return False

            def get_descent(self):
                return 0

        chars_in_abstract: List[str] = []
        lt_chars: List[LTChar] = []
        cropbox_in_pdf = (1, 1)
        min_idx_in_page = {1: 1}

        next(pubtator)
        for line in pubtator:
            abstract = line.split('|')[2]

            for c in abstract:
                # create a fake LTChar
                lt_chars.append(
                    LTChar(
                        text=c,
                        matrix=(0, 0, 0, 0, 0, 0),
                        font=Font(fontname=''),
                        fontsize=0,
                        scaling=0,
                        rise=0,
                        textwidth=0,
                        textdisp=None,
                        ncs=None,
                        graphicstate=None,
                    )
                )

        for lt_char in lt_chars:
            chars_in_abstract.append(lt_char.get_text())

        return PDFParsedCharacters(
            char_coord_objs_in_pdf=lt_chars,
            chars_in_pdf=chars_in_abstract,
            cropbox_in_pdf=cropbox_in_pdf,
            min_idx_in_page=min_idx_in_page,
        )

    def parse_pdf(self, pdf) -> PDFParsedCharacters:
        """Parse a PDF and create two dictionaries; one
        containing individual LTChar objects with coordinate
        positions, and the other the string character representation.
        """
        parser = PDFParser(pdf)
        pdf_doc = PDFDocument(parser)
        rsrcmgr = PDFResourceManager()
        device = PDFPageAggregator(rsrcmgr=rsrcmgr, laparams=LAParams())
        interpreter = PDFPageInterpreter(rsrcmgr=rsrcmgr, device=device)

        min_idx_in_page: Dict[int, int] = {}
        chars_in_pdf: List[str] = []
        char_coord_objs_in_pdf: List[Union[LTChar, LTAnno]] = []
        cropbox_in_pdf: Tuple[int, int] = None  # type: ignore

        compiled_regex = re.compile(r'cid:\d+')

        for i, page in enumerate(PDFPage.create_pages(pdf_doc)):
            # get the cropbox left and bottom offset
            # these values will be added to the coordinates
            #
            # cropboxes are used to tell a pdf viewer what the
            # actual visible area of a pdf page is
            #
            # as of JIRA LL-837 it seems the pdf viewer library
            # we're using is using the mediabox values
            # this might change if we switch pdf viewer library
            #
            # in most cases, both cropboxes and mediaboxes have the
            # same values, but the pdf in JIRA LL-837 had different
            # values
            cropbox_in_pdf = (page.mediabox[0], page.mediabox[1])
            interpreter.process_page(page)
            layout = device.get_result()
            min_idx_in_page[len(char_coord_objs_in_pdf)] = i+1
            self._get_lt_char(
                layout=layout,
                char_coord_objs_in_pdf=char_coord_objs_in_pdf,
                compiled_regex=compiled_regex,
            )

        for lt_char in char_coord_objs_in_pdf:
            chars_in_pdf.append(lt_char.get_text())

        return PDFParsedCharacters(
            char_coord_objs_in_pdf=char_coord_objs_in_pdf,
            chars_in_pdf=chars_in_pdf,
            cropbox_in_pdf=cropbox_in_pdf,
            min_idx_in_page=min_idx_in_page,
        )

    def _isfloat(self, value: str) -> bool:
        # not float
        # better than using regex
        try:
            float(value)
            return True
        except ValueError:
            return False

    def _is_whitespace(self, char: str) -> bool:
        return char in whitespace or char == '\xa0'

    def _not_whitespace(self, char: str) -> bool:
        return char not in whitespace and char != '\xa0'

    def remove_leading_trailing_punctuation(
        self,
        word: str,
        char_map: Dict[int, str],
    ) -> Tuple[str, dict]:
        """Only remove balanced opening and closing punctuation.
        """
        opening_punc = {'(', '[', '{'}
        closing_punc = {')', ']', '}'}
        leading_punc = set(punctuation) - opening_punc
        trailing_punc = set(punctuation) - set.union(*[closing_punc, {'+', '-'}])  # type: ignore
        ending_punc = {'.', ',', '?', '!'}

        char_map_copy = {k: v for k, v in char_map.items()}
        word_copy = word
        idx_keys = list(char_map_copy)

        try:
            # ending punctuation
            while word_copy and word_copy[-1] in ending_punc:
                word_copy = word_copy[:-1]
                del char_map_copy[idx_keys[-1]]
                idx_keys = list(char_map_copy)

            if word_copy:
                # now check for other punctuations
                # e.g (circle).
                # the period was removed in previous if block
                while word_copy and (word_copy[0] in opening_punc and word_copy[-1] in closing_punc):  # noqa
                    if word_copy[0] == '(' and word_copy[-1] == ')' or \
                        word_copy[0] == '[' and word_copy[-1] == ']' or \
                            word_copy[0] == '{' and word_copy[-1] == '}':
                        word_copy = word_copy[1:-1]
                        del char_map_copy[idx_keys[0]]
                        del char_map_copy[idx_keys[-1]]
                        idx_keys = list(char_map_copy)
                    else:
                        # did not match
                        break

                if word_copy:
                    if word_copy[0] in opening_punc:
                        closing_idx = []
                        for i, c in enumerate(word_copy[1:]):
                            if c in closing_punc:
                                if word_copy[0] == '(' and c == ')' or \
                                    word_copy[0] == '[' and c == ']' or \
                                        word_copy[0] == '{' and c == '}':
                                    # can't assume any punctuation in
                                    # middle of word in not part of word
                                    # so just break if found one matching closing
                                    closing_idx.append(i)
                                    break

                        if not closing_idx:
                            # no matching closing punctuation found
                            # so delete
                            word_copy = word_copy[1:]
                            del char_map_copy[idx_keys[0]]
                            idx_keys = list(char_map_copy)

                if word_copy:
                    if word_copy[-1] in closing_punc:
                        opening_idx = []
                        for i, c in enumerate(reversed(word_copy[:-1])):
                            if c in opening_punc:
                                if word_copy[-1] == ')' and c == '(' or \
                                    word_copy[-1] == ']' and c == '[' or \
                                        word_copy[-1] == '}' and c == '{':
                                    # can't assume any punctuation in
                                    # middle of word in not part of word
                                    # so just break if found one matching opening
                                    opening_idx.append(i)
                                    break

                        if not opening_idx:
                            # no matching opening punctuation found
                            # so delete
                            word_copy = word_copy[:-1]
                            del char_map_copy[idx_keys[-1]]
                            idx_keys = list(char_map_copy)

                if word_copy:
                    # strip the first leading and trailing only
                    # because can't assume any others are not
                    # part of word
                    if word_copy[-1] in trailing_punc:
                        word_copy = word_copy[:-1]
                        del char_map_copy[idx_keys[-1]]
                    if word_copy and word_copy[0] in leading_punc:
                        word_copy = word_copy[1:]
                        del char_map_copy[idx_keys[0]]

        except IndexError:
            raise AnnotationError(
                'Index key error occurred when stripping leading and trailing punctuation.'
                f' For word "{word}"')
        return word_copy, char_map_copy

    def combine_all_chars(
        self,
        parsed_chars: PDFParsedCharacters,
    ) -> str:
        """Combines a list of char into a large string. Cannot use
        pdfminer.high_level() because it produces different string
        compared to the chars produced with coordinates.

        Different from self.combine_chars_into_words() because that one
        combines into individual words while ignoring unneeded chars to use
        in our sequential walking combination. So the chars and coordinate
        index mapping will not match with the results returned from the
        NLP service.

        For NLP, use this function instead. This function also produces
        exactly what pdfminer outputs.
        """
        char_list = parsed_chars.chars_in_pdf
        return ''.join(char_list)

    def combine_chars_into_words(
        self,
        parsed_chars: PDFParsedCharacters,
    ) -> List[Tuple[str, Dict[int, str]]]:
        """Combines a list of char into a list of words with the
        position index of each char in the word.

        E.g {0: 'H', 1: 'e', 2: 'l', 3: 'l', 4: 'o', 5: ' ', 6: ' ', 7:'T', ...}
            - this returns a list of tuples:
            ('Hello', {0: 'H', 1: 'e', 2: 'l', 3: 'l', 4: 'o'})
            ('There', {7: 'T', 8: 'h', 9: 'e', ...})
        """
        char_list = parsed_chars.chars_in_pdf

        words_with_char_idx: List[Tuple[str, Dict[int, str]]] = []
        char_idx_map: Dict[int, str] = {}
        max_length = len(char_list)
        word = ''

        for i, char in enumerate(char_list):
            try:
                if ord(char) in MISC_SYMBOLS_AND_CHARS:
                    # need to clean because some times hyphens
                    # are parsed as a char that's represented by a
                    # unicode and doesn't match the string hyphen
                    curr_char = clean_char(char)
                else:
                    curr_char = char

                if ord(char_list[i-1]) in MISC_SYMBOLS_AND_CHARS:
                    prev_char = clean_char(char_list[i-1])
                else:
                    prev_char = char_list[i-1]

                if curr_char in whitespace and prev_char != '-':
                    if char_idx_map:
                        if word[0] in ascii_letters and word[-1] in ascii_letters:
                            words_with_char_idx.append((word, char_idx_map))
                            char_idx_map = {}
                            word = ''
                        else:
                            word, char_idx_map = self.remove_leading_trailing_punctuation(
                                word=word, char_map=char_idx_map,
                            )

                            if word and char_idx_map:
                                words_with_char_idx.append((word, char_idx_map))
                                char_idx_map = {}
                                word = ''
                else:
                    if i + 1 == max_length:
                        # reached end so add whatever is left
                        if curr_char not in whitespace:
                            word += curr_char
                            char_idx_map[i] = curr_char

                        word, char_idx_map = self.remove_leading_trailing_punctuation(
                            word=word, char_map=char_idx_map,
                        )

                        if word and char_idx_map:
                            words_with_char_idx.append((word, char_idx_map))
                            char_idx_map = {}
                            word = ''
                    else:
                        if ord(char_list[i+1]) in MISC_SYMBOLS_AND_CHARS:  # noqa
                            next_char = clean_char(char_list[i+1])
                        else:
                            next_char = char_list[i+1]

                        if ((curr_char == '-' and next_char in whitespace) or
                            (curr_char in whitespace and prev_char == '-')):  # noqa
                            # word is possibly on new line
                            # so ignore the space
                            continue
                        else:
                            word += curr_char
                            char_idx_map[i] = curr_char
            except TypeError:
                # checking ord() failed
                continue

        return words_with_char_idx

    def _combine_sequential_words(
        self,
        words_with_char_idx,
        min_idx_in_page,
        compiled_regex,
    ):
        """Generator that combines a list of words into sequentially increment words.

        E.g ['A', 'B', 'C', 'D', 'E'] -> ['A', 'A B', 'A B C', 'B', 'B C', ...]
            - NOTE: each character here represents a word
        """
        processed_tokens: Set[str] = set()

        end_idx = curr_max_words = 1
        max_length = len(words_with_char_idx)

        # now create keyword tokens up to self.max_word_length
        for i, _ in enumerate(words_with_char_idx):
            while curr_max_words <= self.max_word_length and end_idx <= max_length:  # noqa
                word_char_idx_map_pairing = words_with_char_idx[i:end_idx]
                words = [word for word, _ in word_char_idx_map_pairing]
                curr_char_idx_mappings = {k: v for _, d in word_char_idx_map_pairing for k, v in d.items()}  # noqa

                curr_keyword = ' '.join(words)

                last_char_idx_in_curr_keyword = list(curr_char_idx_mappings)[-1]

                page_idx = -1
                for min_page_idx in list(min_idx_in_page):
                    if last_char_idx_in_curr_keyword <= min_page_idx:
                        # reminder: can break here because dict in python 3.8+ are
                        # insertion order
                        break
                    else:
                        page_idx = min_page_idx

                if not self._isfloat(curr_keyword):
                    if (curr_keyword.lower() not in COMMON_WORDS and
                        not compiled_regex.match(curr_keyword) and
                        curr_keyword not in ascii_letters and
                        curr_keyword not in digits):  # noqa

                        token = PDFTokenPositions(
                            page_number=min_idx_in_page[page_idx],
                            keyword=curr_keyword,
                            char_positions=curr_char_idx_mappings,
                        )
                        yield token

                curr_max_words += 1
                end_idx += 1
            curr_max_words = 1
            end_idx = i + 2

    def extract_tokens(
        self,
        parsed_chars: PDFParsedCharacters,
    ) -> PDFTokenPositionsList:
        """Extract word tokens from the parsed characters.

        Returns a token list of sequentially concatentated
        words up to the @self.max_word_length. Each token object
        in the list will contain the keyword, and the index of
        each char in the keyword.
        """
        # first combine the chars into words
        words_with_char_idx = self.combine_chars_into_words(parsed_chars=parsed_chars)

        # regex to check for digits with punctuation
        compiled_regex = re.compile(r'[\d{}]+$'.format(re.escape(punctuation)))

        return PDFTokenPositionsList(
            token_positions=self._combine_sequential_words(
                words_with_char_idx=words_with_char_idx,
                min_idx_in_page=parsed_chars.min_idx_in_page,
                compiled_regex=compiled_regex,
            ),
            char_coord_objs_in_pdf=parsed_chars.char_coord_objs_in_pdf,
            cropbox_in_pdf=parsed_chars.cropbox_in_pdf,
            min_idx_in_page=parsed_chars.min_idx_in_page,
        )
