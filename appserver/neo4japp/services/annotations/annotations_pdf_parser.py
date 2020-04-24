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

        str_per_pdf_page: Dict[int, List[str]] = dict()
        coor_obj_per_pdf_page: Dict[int, List[Union[LTChar, LTAnno]]] = dict()

        for i, page in enumerate(PDFPage.create_pages(pdf_doc)):
            interpreter.process_page(page)
            layout = device.get_result()
            self._get_lt_char(
                layout=layout,
                page_idx=i,
                coor_obj_per_pdf_page=coor_obj_per_pdf_page,
            )

        for page_idx, lt_char_list in coor_obj_per_pdf_page.items():
            if lt_char_list[-1].get_text() not in whitespace:
                lt_char_list.append(LTAnno(' '))
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
        )

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
        """
        curr_max_words = 1
        token_objects: List[PDFTokenPositions] = []

        processed_tokens: Set[str] = set()

        for page_idx, char_list in parsed_chars.str_per_pdf_page.items():
            curr_page = page_idx
            max_length = len(char_list)
            curr_idx = 0
            new_start_idx = 0
            first_whitespace_encountered_idx = 0

            while curr_idx < max_length:
                curr_keyword = ''

                while curr_max_words <= self.max_word_length:
                    whitespace_count = 0
                    char_idx_map: Dict[int, str] = {}

                    while whitespace_count < curr_max_words and curr_idx < max_length:
                        # ignore leading spaces or punctuations
                        if (curr_keyword == '' and
                            (char_list[curr_idx] in whitespace or
                                char_list[curr_idx] == '\xa0' or
                                char_list[curr_idx] in punctuation)):
                            curr_idx += 1
                        else:
                            if (char_list[curr_idx] not in whitespace and
                                    char_list[curr_idx] != '\xa0'):
                                curr_keyword += char_list[curr_idx]
                                char_idx_map[curr_idx] = char_list[curr_idx]
                                curr_idx += 1
                            else:
                                # encountered whitespace
                                # \xa0 is non-breaking whitespace

                                # check if double spacing
                                if (curr_idx+1 < max_length and
                                        (char_list[curr_idx+1] in whitespace or
                                            char_list[curr_idx+1] == '\xa0')):
                                    curr_idx += 1
                                else:
                                    # if whitespace encountered, but previous
                                    # character is '-', then don't count the
                                    # whitespace as likely word continues on
                                    # new line
                                    # this is to account turning '\n' into ' '
                                    # in @parse_pdf()
                                    if char_list[curr_idx - 1] == '-':
                                        curr_idx += 1
                                    else:
                                        if whitespace_count == 0:
                                            first_whitespace_encountered_idx = curr_idx

                                        # each whitespace encountered means a
                                        # whole word has been processed
                                        if whitespace_count + 1 < curr_max_words:
                                            curr_keyword += char_list[curr_idx]
                                            char_idx_map[curr_idx] = char_list[curr_idx]
                                            curr_idx += 1
                                        whitespace_count += 1

                    token = PDFTokenPositions(
                        page_number=curr_page,
                        keyword=curr_keyword,
                        char_positions=char_idx_map,
                    )
                    hashval = compute_hash(token.to_dict())
                    if hashval not in processed_tokens:
                        processed_tokens.add(hashval)
                        token_objects.append(token)

                    curr_idx = new_start_idx
                    curr_keyword = ''
                    curr_max_words += 1

                curr_max_words = 1
                whitespace_count = 0
                curr_idx = first_whitespace_encountered_idx + 1
                # setting first_whitespace_encountered_idx to curr_idx
                # to avoid edge case that causes infinite loop
                # if the sequential increment started over at the last word
                # and there is no whitespace after it,
                # it is possible for first_whitespace_encountered_idx
                # to be an idx before the first character of the word
                # meaning it'll be in an infinite loop
                # since curr_idx will always reset to that idx
                first_whitespace_encountered_idx = new_start_idx = curr_idx

        # clean up any duplicates due to whitespace at the end
        # of a page, and the number of words in the keyword
        # hasn't reached the self.max_word_length yet
        #
        # TODO: JIRA LL-460
        keyword_tokens: List[PDFTokenPositions] = []
        keyword_tokens_set: Set[str] = set()

        for token in token_objects:
            if token.keyword[-1] in whitespace or token.keyword[-1] == '\xa0':
                tmp_keyword = token.keyword[:-1]
                tmp_char_positions = {k: v for k, v in token.char_positions.items()}
                tmp_char_positions.popitem()
                hashval = compute_hash(tmp_char_positions)

                if hashval not in keyword_tokens_set:
                    keyword_tokens_set.add(hashval)
                    keyword_tokens.append(PDFTokenPositions(
                        page_number=token.page_number,
                        keyword=tmp_keyword,
                        char_positions=tmp_char_positions,
                    ))
            else:
                hashval = compute_hash(token.char_positions)
                keyword_tokens_set.add(hashval)
                keyword_tokens.append(token)

        return PDFTokenPositionsList(
            token_positions=keyword_tokens,
            coor_obj_per_pdf_page=parsed_chars.coor_obj_per_pdf_page,
        )
