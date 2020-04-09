import re

# from io import StringIO
from string import whitespace
from typing import Any, Dict, List, Set, Tuple

# from pdfminer import high_level
from pdfminer.converter import PDFPageAggregator, TextConverter
from pdfminer.layout import LAParams, LTChar, LTTextBox, LTTextLine
from pdfminer.pdfdocument import PDFDocument
from pdfminer.pdfinterp import PDFResourceManager, PDFPageInterpreter
from pdfminer.pdfpage import PDFPage
from pdfminer.pdfparser import PDFParser

from neo4japp.data_transfer_objects import (
    PDFParsedCharacters,
    PDFTokenPositions,
    PDFTokenPositionsList,
)


class AnnotationsPDFParser:
    def __init__(self) -> None:
        self.max_word_length = 4  # TODO: go into constants.py if used by other classes

    def _get_lt_char(
        self,
        layout: Any,
        page_idx: int,
        coor_obj_per_pdf_page: Dict[int, List[LTChar]],
    ) -> None:
        for lt_obj in layout:
            if isinstance(lt_obj, LTTextBox) or isinstance(lt_obj, LTTextLine):
                self._get_lt_char(
                    layout=lt_obj,
                    page_idx=page_idx,
                    coor_obj_per_pdf_page=coor_obj_per_pdf_page,
                )
            elif isinstance(lt_obj, LTChar):
                if page_idx + 1 in coor_obj_per_pdf_page:
                    coor_obj_per_pdf_page[page_idx+1].append(lt_obj)
                else:
                    coor_obj_per_pdf_page[page_idx+1] = [lt_obj]

    def parse_pdf(self, pdf) -> PDFParsedCharacters:
        """Parse a PDF and create two dictionaries; one
        containing individual LTChar objects with coordinate
        positions, and the other the string character representation.
        """
        # return high_level.extract_text(pdf)
        # str_io = StringIO()
        parser = PDFParser(pdf)
        pdf_doc = PDFDocument(parser)
        rsrcmgr = PDFResourceManager()
        # text_device = TextConverter(rsrcmgr=rsrcmgr, outfp=str_io, laparams=LAParams())
        device = PDFPageAggregator(rsrcmgr=rsrcmgr, laparams=LAParams())
        interpreter = PDFPageInterpreter(rsrcmgr=rsrcmgr, device=device)
        # text_interpreter = PDFPageInterpreter(rsrcmgr=rsrcmgr, device=text_device)

        str_per_pdf_page: Dict[int, List[str]] = {}
        coor_obj_per_pdf_page: Dict[int, List[LTChar]] = {}

        # for i, page in enumerate(PDFPage.create_pages(pdf_doc)):
        #     text_interpreter.process_page(page)
        #     str_per_pdf_page[i+1] = [c for c in str_io.getvalue()]

        for i, page in enumerate(PDFPage.create_pages(pdf_doc)):
            interpreter.process_page(page)
            layout = device.get_result()
            self._get_lt_char(
                layout=layout,
                page_idx=i,
                coor_obj_per_pdf_page=coor_obj_per_pdf_page,
            )

            # for lt_obj in layout:
            #     if isinstance(lt_obj, LTTextBox):
            #         for lt_line in lt_obj:
            #             if isinstance(lt_line, LTTextLine):
            #                 for lt_char in lt_line:
            #                     if isinstance(lt_char, LTChar):
            #                         if i + 1 in coor_obj_per_pdf_page:
            #                             coor_obj_per_pdf_page[i+1].append(lt_char)
            #                         else:
            #                             coor_obj_per_pdf_page[i+1] = [lt_char]

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
        """Extract word tokens from the text argument.

        Returns a token set of sequentially concatentated
        words up to the max word length.

        E.g ['A', 'B', 'C', 'D', 'E'] -> ['A', 'A B', 'A B C', 'B', 'B C', ...]
        """
        curr_max_words = 1
        new_start_idx = 0
        token_objects: List[PDFTokenPositions] = []

        for page_idx, char_list in parsed_chars.str_per_pdf_page.items():
            early_break = False
            curr_page = page_idx
            max_length = len(char_list)
            curr_idx = 0

            while curr_idx < max_length:
                curr_keyword = ''

                while curr_max_words <= self.max_word_length:
                    whitespace_count = 0
                    char_idx_map: Dict[int, str] = {}

                    while whitespace_count < curr_max_words and curr_idx < max_length:
                        # ignore leading spaces
                        if (curr_keyword == '' and
                            (char_list[curr_idx] in whitespace or
                                char_list[curr_idx] == '\xa0')):
                            curr_idx += 1
                        else:
                            if (char_list[curr_idx] not in whitespace and
                                    char_list[curr_idx] != '\xa0'):
                                curr_keyword += char_list[curr_idx]
                                char_idx_map[curr_idx] = char_list[curr_idx]
                                curr_idx += 1
                            else:
                                if whitespace_count == 0:
                                    first_whitespace_encountered_idx = curr_idx

                                # encountered whitespace
                                # \xa0 is non-breaking whitespace
                                if whitespace_count + 1 < curr_max_words:
                                    curr_keyword += char_list[curr_idx]
                                    char_idx_map[curr_idx] = char_list[curr_idx]
                                    curr_idx += 1
                                whitespace_count += 1

                    token_objects.append(
                        PDFTokenPositions(
                            page_number=curr_page,
                            keyword=curr_keyword,
                            char_positions=char_idx_map,
                        ),
                    )

                    # in case we're at the end of page
                    # but the token word length hasn't been reached yet
                    # e.g self.max_word_length is 4 - but the sequential
                    # walking restarted at the last word on the page
                    # so will enter an infinite loop since we'll never
                    # be able to increment sequentially up to self.max_word_length
                    if curr_idx == max_length:
                        early_break = True
                        break

                    curr_idx = new_start_idx
                    curr_keyword = ''
                    curr_max_words += 1

                if early_break:
                    break
                curr_max_words = 1
                whitespace_count = 0
                curr_idx = first_whitespace_encountered_idx + 1
                new_start_idx = curr_idx

        return PDFTokenPositionsList(
            token_positions=token_objects,
            coor_obj_per_pdf_page=parsed_chars.coor_obj_per_pdf_page,
        )














