import re

from string import punctuation, whitespace
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
from neo4japp.util import compute_hash

from .constants import (
    PDF_CHARACTER_SPACING_THRESHOLD,
    PDF_NEW_LINE_THRESHOLD,
)


class AnnotationsPDFParser:
    def __init__(self) -> None:
        # TODO: go into constants.py if used by other classes
        self.max_word_length = 4

    def _get_lt_char(
        self,
        layout: Any,
        page_idx: int,
        coor_obj_per_pdf_page: Dict[int, List[Union[LTChar, LTAnno]]],
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
                    coor_obj_per_pdf_page=coor_obj_per_pdf_page,
                )
            elif isinstance(lt_obj, LTChar) or isinstance(lt_obj, LTAnno):
                # ignore CID fonts
                # these are arithmetic or other symbols the parser
                # was not able to translate
                # usually requires a license or better algorithm from parser
                if not re.search(r'cid:\d+', lt_obj.get_text()):
                    if page_idx + 1 in coor_obj_per_pdf_page:
                        prev_char = coor_obj_per_pdf_page[page_idx+1][-1]
                        if should_add_virtual_space(prev_char, lt_obj):
                            virtual_space_char = LTAnno(' ')
                            coor_obj_per_pdf_page[page_idx+1].append(virtual_space_char)

                        coor_obj_per_pdf_page[page_idx+1].append(lt_obj)
                    else:
                        coor_obj_per_pdf_page[page_idx+1] = [lt_obj]

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

        str_per_pdf_page: Dict[int, List[str]] = {}
        coor_obj_per_pdf_page: Dict[int, List[Union[LTChar, LTAnno]]] = {}
        cropbox_per_page: Dict[int, Tuple[int, int]] = {}

        for i, page in enumerate(PDFPage.create_pages(pdf_doc)):
            cropbox_per_page[i+1] = (page.cropbox[0], page.cropbox[1])
            interpreter.process_page(page)
            layout = device.get_result()
            self._get_lt_char(
                layout=layout,
                page_idx=i,
                coor_obj_per_pdf_page=coor_obj_per_pdf_page,
            )

        for page_idx, lt_char_list in coor_obj_per_pdf_page.items():
            for lt_char in lt_char_list:
                # LTAnno are 'virtual' characters inserted by the parser
                # don't really care for \n so make them whitespace
                # cannot simply deleted because after being parsed, some
                # PDFs use \n as a space between words
                # consider this when extracting tokens in @extract_tokens()
                if isinstance(lt_char, LTAnno) and lt_char.get_text() == '\n':
                    lt_char._text = ' '

        for page_num, lt_char_list in coor_obj_per_pdf_page.items():
            str_per_pdf_page[page_num] = []
            for lt_char in lt_char_list:
                str_per_pdf_page[page_num].append(lt_char.get_text())

        return PDFParsedCharacters(
            coor_obj_per_pdf_page=coor_obj_per_pdf_page,
            str_per_pdf_page=str_per_pdf_page,
            cropbox_per_page=cropbox_per_page,
        )

    def _is_whitespace_or_punctuation(self, text: str) -> bool:
        return text in whitespace or text == '\xa0' or text in punctuation  # noqa

    def _is_whitespace(self, text: str) -> bool:
        # whitespace contains newline
        return text in whitespace or text == '\xa0'

    def _has_unwanted_punctuation(self, text: str) -> bool:
        return text == ',' or text == '.' or text == ')' or text == '('

    def combine_chars_into_words(
        self,
        parsed_chars: PDFParsedCharacters,
    ) -> Dict[int, List[Tuple[str, Dict[int, str]]]]:
        """Combines a list of char into a list of words.

        E.g ['H', 'e', 'l', 'l', 'o', ' ', 'T', 'h', 'e', 'r', 'e']
        becomes ['Hello', 'There']
        """
        words_with_char_idx: Dict[int, List[Tuple[str, Dict[int, str]]]] = {}

        # first combine each character into single words
        # and save each character's index relative to page it's on
        for page_idx, char_list in parsed_chars.str_per_pdf_page.items():
            word_list: List[Tuple[str, Dict[int, str]]] = []
            char_idx_map: Dict[int, str] = {}
            max_length = len(char_list)
            word = ''

            for i, char in enumerate(char_list):
                if char in whitespace and char_list[i-1] != '-':
                    if char_idx_map:
                        word_list.append((word, char_idx_map))
                        char_idx_map = {}
                        word = ''
                elif char in whitespace and char_list[i-1] == '-':
                    # word is possibly on new line
                    # so ignore the space
                    pass
                else:
                    if i + 1 == max_length:
                        # reached end so add whatever is left
                        word += char
                        char_idx_map[i] = char
                        word_list.append((word, char_idx_map))
                        char_idx_map = {}
                        word = ''
                    else:
                        word += char
                        char_idx_map[i] = char

            words_with_char_idx[page_idx] = word_list
        return words_with_char_idx

    def extract_tokens(
        self,
        parsed_chars: PDFParsedCharacters,
    ) -> PDFTokenPositionsList:
        """Extract word tokens from the parsed characters.

        Returns a token list of sequentially concatentated
        words up to the @self.max_word_length. Each token object
        in the list will contain the keyword, and the index of
        each keyword.

        E.g ['A', 'B', 'C', 'D', 'E'] -> ['A', 'A B', 'A B C', 'B', 'B C', ...]
            - NOTE: each character here represents a word
        """
        keyword_tokens: List[PDFTokenPositions] = []
        words_with_char_idx = self.combine_chars_into_words(parsed_chars=parsed_chars)

        curr_max_words = 1
        processed_tokens: Set[str] = set()

        # now create keyword tokens up to self.max_word_length
        for page_idx, words_char_idx_list in words_with_char_idx.items():
            end_idx = 1
            max_length = len(words_char_idx_list)

            for i, _ in enumerate(words_char_idx_list):
                while curr_max_words <= self.max_word_length and end_idx <= max_length:  # noqa
                    word_char_idx_map_pairing = words_char_idx_list[i:end_idx]
                    words = [word for word, _ in word_char_idx_map_pairing]
                    char_idx_maps = [char_idx_map for _, char_idx_map in word_char_idx_map_pairing]  # noqa

                    curr_keyword = ' '.join(words)
                    if not self._is_whitespace_or_punctuation(curr_keyword):
                        curr_char_idx_mappings: Dict[int, str] = {}

                        # need to keep order here so can't unpack (?)
                        for char_map in char_idx_maps:
                            for k, v in char_map.items():
                                curr_char_idx_mappings[k] = v

                        # strip out trailing punctuations
                        while curr_keyword and self._has_unwanted_punctuation(curr_keyword[-1]):
                            dict_keys = list(curr_char_idx_mappings.keys())
                            last = dict_keys[-1]
                            curr_char_idx_mappings.pop(last)
                            curr_keyword = curr_keyword[:-1]

                        # strip out leading punctuations
                        while curr_keyword and self._has_unwanted_punctuation(curr_keyword[0]):
                            dict_keys = list(curr_char_idx_mappings.keys())
                            first = dict_keys[0]
                            curr_char_idx_mappings.pop(first)
                            curr_keyword = curr_keyword[1:]

                        # keyword could've been all punctuation
                        if curr_keyword:
                            token = PDFTokenPositions(
                                page_number=page_idx,
                                keyword=curr_keyword,
                                char_positions=curr_char_idx_mappings,
                            )

                            # need to do this check because
                            # could potentially have duplicates due to
                            # the sequential increment starting over
                            # at end of page
                            hashval = compute_hash(token.to_dict())
                            if hashval not in processed_tokens:
                                keyword_tokens.append(token)
                                processed_tokens.add(hashval)

                    curr_max_words += 1
                    end_idx += 1
                curr_max_words = 1
                end_idx = i + 2

        return PDFTokenPositionsList(
            token_positions=keyword_tokens,
            coor_obj_per_pdf_page=parsed_chars.coor_obj_per_pdf_page,
            cropbox_per_page=parsed_chars.cropbox_per_page,
        )
