import re

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

    def _get_lt_char(
        self,
        layout: Any,
        page_idx: int,
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
                isinstance(prev_char, LTChar) and prev_char.get_text() != ' ' and
                isinstance(curr_char, LTChar) and curr_char.get_text() != ' ' and
                space_exists_between_lt_chars(prev_char, curr_char)
            )

        for lt_obj in layout:
            if isinstance(lt_obj, LTTextBox) or isinstance(lt_obj, LTTextLine) or isinstance(lt_obj, LTFigure):  # noqa
                self._get_lt_char(
                    layout=lt_obj,
                    page_idx=page_idx,
                    char_coord_objs_in_pdf=char_coord_objs_in_pdf,
                    compiled_regex=compiled_regex,
                )
            elif isinstance(lt_obj, LTChar) or isinstance(lt_obj, LTAnno):
                # ignore CID fonts
                # these are arithmetic or other symbols the parser
                # was not able to translate
                # usually requires a license or better algorithm from parser
                if not re.search(compiled_regex, lt_obj.get_text()):
                    if char_coord_objs_in_pdf:
                        prev_char = char_coord_objs_in_pdf[-1]
                        if should_add_virtual_space(prev_char, lt_obj):
                            virtual_space_char = LTAnno(' ')
                            char_coord_objs_in_pdf.append(virtual_space_char)
                    char_coord_objs_in_pdf.append(lt_obj)

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

        max_idx_in_page: Dict[int, int] = {}
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
            self._get_lt_char(
                layout=layout,
                page_idx=i,
                char_coord_objs_in_pdf=char_coord_objs_in_pdf,
                compiled_regex=compiled_regex,
            )
            max_idx_in_page[len(char_coord_objs_in_pdf)-1] = i+1

        for lt_char in char_coord_objs_in_pdf:
            # LTAnno are 'virtual' characters inserted by the parser
            # don't really care for \n so make them whitespace
            # cannot simply deleted because after being parsed, some
            # PDFs use \n as a space between words
            # consider this when extracting tokens in @extract_tokens()
            if isinstance(lt_char, LTAnno) and lt_char.get_text() == '\n':
                lt_char._text = ' '
            chars_in_pdf.append(lt_char.get_text())

        return PDFParsedCharacters(
            char_coord_objs_in_pdf=char_coord_objs_in_pdf,
            chars_in_pdf=chars_in_pdf,
            cropbox_in_pdf=cropbox_in_pdf,
            max_idx_in_page=max_idx_in_page,
        )

    def _not_all_whitespace_or_punctuation(self, text: str) -> bool:
        for c in text:
            if c in ascii_letters:
                return True
        return False

    def _is_whitespace_or_punctuation(self, char: str) -> bool:
        # whitespace contains newline
        return char in whitespace or char == '\xa0' or char in punctuation  # noqa

    def _has_unwanted_punctuation(self, char: str, leading: bool = False) -> bool:
        # want to keep things like plus, minus, etc
        ignore_these = set(punctuation) - {'+', '-'}
        check = char in ignore_these
        if leading:
            # hyphens not minus
            check = check or char == '-'
        return check

    def combine_chars_into_words(
        self,
        parsed_chars: PDFParsedCharacters,
    ) -> List[Tuple[str, Dict[int, str]]]:
        """Combines a list of char into a list of words with the
        position index of each char in the word.

        E.g ['H', 'e', 'l', 'l', 'o', ' ', 'T', 'h', 'e', 'r', 'e']
        becomes ['Hello', 'There']
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
                            pass
                        else:
                            word += curr_char
                            char_idx_map[i] = curr_char
            except TypeError:
                # checking ord() failed
                continue
        return words_with_char_idx

    def extract_tokens(
        self,
        parsed_chars: PDFParsedCharacters,
    ) -> PDFTokenPositionsList:
        """Extract word tokens from the parsed characters.

        Returns a token list of sequentially concatentated
        words up to the @self.max_word_length. Each token object
        in the list will contain the keyword, and the index of
        each char in the keyword.

        E.g ['A', 'B', 'C', 'D', 'E'] -> ['A', 'A B', 'A B C', 'B', 'B C', ...]
            - NOTE: each character here represents a word
        """
        keyword_tokens: List[PDFTokenPositions] = []
        processed_tokens: Set[str] = set()

        # first combine the chars into words
        words_with_char_idx = self.combine_chars_into_words(parsed_chars=parsed_chars)

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

                if not self._is_whitespace_or_punctuation(curr_keyword) and self._not_all_whitespace_or_punctuation(curr_keyword):  # noqa
                    curr_char_idx_mappings: Dict[int, str] = {}

                    # need to keep order here so can't unpack (?)
                    last_char_idx_in_curr_keyword = -1
                    for char_map in char_idx_maps:
                        for k, v in char_map.items():
                            curr_char_idx_mappings[k] = v
                            last_char_idx_in_curr_keyword = k

                    try:
                        # strip out trailing punctuation
                        while curr_keyword and self._has_unwanted_punctuation(curr_keyword[-1]):
                            dict_keys = list(curr_char_idx_mappings.keys())
                            last = dict_keys[-1]
                            curr_char_idx_mappings.pop(last)
                            curr_keyword = curr_keyword[:-1]

                        # strip out leading punctuation
                        while curr_keyword and self._has_unwanted_punctuation(curr_keyword[0], leading=True):  # noqa
                            dict_keys = list(curr_char_idx_mappings.keys())
                            first = dict_keys[0]
                            curr_char_idx_mappings.pop(first)
                            curr_keyword = curr_keyword[1:]
                    except KeyError:
                        raise AnnotationError('Index key error occurred when stripping leading and trailing punctuation.')  # noqa

                    # keyword could've been all punctuation
                    if curr_keyword:
                        page_idx = -1
                        for max_page_idx in list(parsed_chars.max_idx_in_page):
                            if last_char_idx_in_curr_keyword <= max_page_idx:
                                page_idx = max_page_idx
                                # reminder: can break here because dict in python 3.8+ are
                                # insertion order
                                break

                        # whitespaces don't exist in curr_char_idx_mappings
                        # they were added to separate words
                        # and might've been left behind after stripping out
                        # unwanted punctuation
                        curr_keyword = curr_keyword.strip()

                        if (curr_keyword.lower() not in COMMON_WORDS and
                            not re.match(compiled_regex, curr_keyword) and
                            curr_keyword not in ascii_letters and
                            curr_keyword not in digits):  # noqa

                            token = PDFTokenPositions(
                                page_number=parsed_chars.max_idx_in_page[page_idx],
                                keyword=curr_keyword,
                                char_positions=curr_char_idx_mappings,
                            )
                            # need to do this check because
                            # could potentially have duplicates due to
                            # removing punctuation
                            hashval = token.to_dict_hash()
                            if hashval not in processed_tokens:
                                keyword_tokens.append(token)
                                processed_tokens.add(hashval)

                curr_max_words += 1
                end_idx += 1
            curr_max_words = 1
            end_idx = i + 2

        return PDFTokenPositionsList(
            token_positions=keyword_tokens,
            char_coord_objs_in_pdf=parsed_chars.char_coord_objs_in_pdf,
            cropbox_in_pdf=parsed_chars.cropbox_in_pdf,
        )
