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

from neo4japp.database import db
from neo4japp.data_transfer_objects import (
    PDFParsedCharacters,
    PDFTokenPositions,
    PDFTokenPositionsList,
)
from neo4japp.exceptions import AnnotationError
from neo4japp.models import AnnotationStopWords

from .constants import (
    # COMMON_WORDS,
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
        self.regex_for_floats = r'^-?\d+(?:\.\d+)?$'

        # TODO: could potentially put into a cache if these words will not be updated
        # often. But future feature will allow users to upload and add
        # to this list, so that means would have to recache.
        # leave as is for now?
        self.COMMON_WORDS = set(
            result.word for result in db.session.query(AnnotationStopWords).all())

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

    def _is_whitespace(self, char: str) -> bool:
        return char in whitespace or char == '\xa0'

    def _not_whitespace(self, char: str) -> bool:
        return char not in whitespace and char != '\xa0'

    def _not_all_whitespace_or_punctuation(self, text: str) -> bool:
        for c in text:
            if c in ascii_letters:
                return True
        return False

    def _remove_leading_and_trailing_punctuation(
        self,
        keyword: str,
        curr_char_idx_mappings: Dict[int, str],
    ) -> Tuple[str, Dict[int, str]]:
        """Check if keyword had leading and trailing punctuation. If keyword
        is end of sentence, will remove period and punctuation before period.
        Will only remove the first leading and trailing punctuation, because
        don't know if other punctuation are part of keyword or not.

        Returns updated keyword and index mapping.
        """
        leading_punctuation = punctuation
        # exclude +, - for chemicals
        trailing_punctuation = set(leading_punctuation) - {'+', '-'}
        period = '.'

        updated_word = keyword
        updated_curr_char_idx_mappings = {k: v for k, v in curr_char_idx_mappings.items()}

        try:
            if keyword[0] in leading_punctuation:
                updated_word = keyword[1:]
                dict_keys = list(updated_curr_char_idx_mappings.keys())
                remove = dict_keys[0]
                updated_curr_char_idx_mappings.pop(remove)

            if keyword[-1] == period and keyword[-2] in trailing_punctuation:
                updated_word = updated_word[:-2]
                dict_keys = list(updated_curr_char_idx_mappings.keys())
                for remove in [dict_keys[-1], dict_keys[-2]]:
                    updated_curr_char_idx_mappings.pop(remove)
            elif keyword[-1] in trailing_punctuation:
                updated_word = updated_word[:-1]
                dict_keys = list(updated_curr_char_idx_mappings.keys())
                remove = dict_keys[-1]
                updated_curr_char_idx_mappings.pop(remove)
        except KeyError:
            raise AnnotationError('Index key error occurred when stripping leading and trailing punctuation.')  # noqa

        return updated_word, updated_curr_char_idx_mappings

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
                # some characters can be a combination of two characters
                # e.g `fi` this is a legit character related to the
                # production of the document and OCR
                if len(char) == 1 and ord(char) in MISC_SYMBOLS_AND_CHARS:
                    # need to clean because some times hyphens
                    # are parsed as a char that's represented by a
                    # unicode and doesn't match the string hyphen
                    curr_char = clean_char(char)
                else:
                    curr_char = char

                if len(char_list[i-1]) == 1 and ord(char_list[i-1]) in MISC_SYMBOLS_AND_CHARS:
                    prev_char = clean_char(char_list[i-1])
                else:
                    prev_char = char_list[i-1]

                if curr_char in whitespace and prev_char != '-':
                    if char_idx_map:
                        words_with_char_idx.append((word, char_idx_map))
                        char_idx_map = {}
                        word = ''
                else:
                    if i + 1 == max_length:
                        # reached end so add whatever is left
                        word += curr_char
                        char_idx_map[i] = curr_char
                        words_with_char_idx.append((word, char_idx_map))
                        char_idx_map = {}
                        word = ''
                    else:
                        if len(char_list[i+1]) == 1 and ord(char_list[i+1]) in MISC_SYMBOLS_AND_CHARS:  # noqa
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
    ):
        """Generator that combines a list of words into sequentially increment words.

        E.g ['A', 'B', 'C', 'D', 'E'] -> ['A', 'A B', 'A B C', 'B', 'B C', ...]
            - NOTE: each character here represents a word
        """
        processed_tokens: Set[str] = set()

        compiled_regex = re.compile(self.regex_for_floats)
        end_idx = curr_max_words = 1
        max_length = len(words_with_char_idx)

        # now create keyword tokens up to self.max_word_length
        for i, _ in enumerate(words_with_char_idx):
            while curr_max_words <= self.max_word_length and end_idx <= max_length:  # noqa
                word_char_idx_map_pairing = words_with_char_idx[i:end_idx]
                words = [word for word, _ in word_char_idx_map_pairing]
                char_idx_maps = [char_idx_map for _, char_idx_map in word_char_idx_map_pairing]  # noqa

                curr_keyword = ' '.join(words)

                if self._not_all_whitespace_or_punctuation(curr_keyword):  # noqa
                    curr_char_idx_mappings: Dict[int, str] = {}

                    # need to keep order here so can't unpack (?)
                    last_char_idx_in_curr_keyword = -1
                    for char_map in char_idx_maps:
                        for k, v in char_map.items():
                            curr_char_idx_mappings[k] = v
                            last_char_idx_in_curr_keyword = k

                    curr_keyword, curr_char_idx_mappings = self._remove_leading_and_trailing_punctuation(  # noqa
                        keyword=curr_keyword, curr_char_idx_mappings=curr_char_idx_mappings)

                    # keyword could've been all punctuation
                    if curr_keyword:
                        page_idx = -1
                        for min_page_idx in list(min_idx_in_page):
                            if last_char_idx_in_curr_keyword <= min_page_idx:
                                # reminder: can break here because dict in python 3.8+ are
                                # insertion order
                                break
                            else:
                                page_idx = min_page_idx

                        # whitespaces don't exist in curr_char_idx_mappings
                        # they were added to separate words
                        # and might've been left behind after stripping out
                        # unwanted punctuation since they can
                        # be separated word
                        curr_keyword = curr_keyword.strip()

                        if (curr_keyword.lower() not in self.COMMON_WORDS and
                            not re.match(compiled_regex, curr_keyword) and
                            curr_keyword not in ascii_letters and
                            curr_keyword not in digits):  # noqa

                            token = PDFTokenPositions(
                                page_number=min_idx_in_page[page_idx],
                                keyword=curr_keyword,
                                char_positions=curr_char_idx_mappings,
                            )
                            uid = f'{str(token.page_number)}{token.keyword}{json.dumps(token.char_positions)}'  # noqa
                            # need to do this check because
                            # could potentially have duplicates due to
                            # removing punctuation
                            # because punctuation could've been a separated word
                            if uid not in processed_tokens:
                                processed_tokens.add(uid)
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

        return PDFTokenPositionsList(
            token_positions=self._combine_sequential_words(
                words_with_char_idx=words_with_char_idx,
                min_idx_in_page=parsed_chars.min_idx_in_page,
            ),
            char_coord_objs_in_pdf=parsed_chars.char_coord_objs_in_pdf,
            cropbox_in_pdf=parsed_chars.cropbox_in_pdf,
            min_idx_in_page=parsed_chars.min_idx_in_page,
        )
