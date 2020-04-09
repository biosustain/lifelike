import re

# from io import StringIO
from typing import Any, List, Set

# from pdfminer import high_level
from pdfminer.converter import PDFPageAggregator, TextConverter
from pdfminer.layout import LAParams, LTTextBox, LTTextLine, LTChar
from pdfminer.pdfdocument import PDFDocument
from pdfminer.pdfinterp import PDFResourceManager, PDFPageInterpreter
from pdfminer.pdfpage import PDFPage
from pdfminer.pdfparser import PDFParser


class TokenExtractor:
    def __init__(self) -> None:
        self.max_word_length = 4  # TODO: go into constants.py if used by other classes

    def parse_pdf(self, pdf) -> str:
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
        coor_obj_per_pdf_page: Dict[int, List[Any]] = {}

        # for i, page in enumerate(PDFPage.create_pages(pdf_doc)):
        #     text_interpreter.process_page(page)
        #     str_per_pdf_page[i+1] = [c for c in str_io.getvalue()]

        for i, page in enumerate(PDFPage.create_pages(pdf_doc)):
            interpreter.process_page(page)
            layout = device.get_result()

            for lt_obj in layout:
                if isinstance(lt_obj, LTTextBox):
                    for lt_line in lt_obj:
                        if isinstance(lt_line, LTTextLine):
                            for lt_char in lt_line:
                                if isinstance(lt_char, LTChar):
                                    if i + 1 in coor_obj_per_pdf_page:
                                        coor_obj_per_pdf_page[i+1].append(lt_char)
                                    else:
                                        coor_obj_per_pdf_page[i+1] = [lt_char]

        for page_num, lt_char_list in coor_obj_per_pdf_page.items():
            str_per_pdf_page[page_num] = []
            for lt_char in lt_char_list:
                str_per_pdf_page[page_num].append(lt_char._text)

        import IPython; IPython.embed()

    def extract_tokens(self, text: str) -> Set[str]:
        """Extract word tokens from the text argument.

        Returns a token set of sequentially concatentated
        words up to the max word length.

        E.g ['A', 'B', 'C', 'D', 'E'] -> ['A', 'A B', 'A B C', 'B', 'B C', ...]
        """
        # do negative lookahead and lookbehind
        # split on single spaces only while keeping
        # multiple spaces as one word
        #
        # e.g e. coli -> ['e.', 'coli']
        # e.g e.   coli -> ['e.   coli']
        word_list = re.split(r'(?<!\s) (?!\s)|\n', text)

        end_index = curr_max_words = 1
        tokens = set()
        max_length = len(word_list)

        for i, _ in enumerate(word_list):
            while curr_max_words <= self.max_word_length and end_index <= max_length:
                word = ' '.join(word_list[i:end_index]).strip()
                if word and word != ' ' and word not in tokens:
                    tokens.add(word)
                    curr_max_words += 1
                end_index += 1
            curr_max_words = 1
            end_index = i + 2

        return tokens
