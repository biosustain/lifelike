import json
import re

from string import ascii_letters, digits, punctuation, whitespace
from typing import Any, List, Set, Tuple

from pdfminer import high_level
from pdfminer.converter import PDFPageAggregator, TextConverter
from pdfminer.layout import LAParams, LTAnno, LTChar, LTTextBox, LTTextLine, LTFigure
from pdfminer.pdfdocument import PDFDocument
from pdfminer.pdfinterp import PDFResourceManager, PDFPageInterpreter
from pdfminer.pdfpage import PDFPage
from pdfminer.pdfparser import PDFParser

from neo4japp.exceptions import AnnotationError
from neo4japp.services.annotations.data_transfer_objects import (
    PDFChar,
    PDFMeta,
    PDFWord,
    PDFParsedContent,
    PDFTokensList
)
from neo4japp.util import clean_char, normalize_str

from .constants import (
    COMMON_WORDS,
    LIGATURES,
    MAX_ABBREVIATION_WORD_LENGTH,
    MISC_SYMBOLS_AND_CHARS,
    PDF_CHARACTER_SPACING_THRESHOLD,
    PDF_NEW_LINE_THRESHOLD,
    SPACE_COORDINATE_FLOAT
)


class AnnotationPDFParser:
    def _get_lt_char(
        self,
        layout: Any,
        char_coord_objs_in_pdf: List[PDFChar],
        compiled_regex: re.Pattern,
        cropbox: Tuple[int, int],
        page_number: int
    ) -> None:
        def space_exists_between_lt_chars(a: PDFChar, b: PDFChar):
            """Determines if a space character exists between two LTChars."""
            # if x1's are not equal that means horizontal and new line
            # otherwise new line but rotated text so shouldn't have space
            return (
                (b.x0 - a.x1 > a.width * PDF_CHARACTER_SPACING_THRESHOLD) or
                (abs(b.y0 - a.y0) > a.height * PDF_NEW_LINE_THRESHOLD)
            ) and b.x1 != a.x1

        def should_add_virtual_space(
            prev_char: PDFChar,
            curr_char: PDFChar
        ):
            return self._not_whitespace(char=prev_char.text) and \
                self._not_whitespace(char=curr_char.text) and \
                    space_exists_between_lt_chars(prev_char, curr_char)  # noqa

        def expand_ligatures(ligature_char: PDFChar):
            ligatures_list: List[PDFChar] = []
            ligature_str_len = len(ligature_char.text)

            original_lig_end_x = ligature_char.x1
            original_lig_str = ligature_char.text

            if ligature_str_len == 2:
                # for two characters ligatures
                ligature_char.x1 = ligature_char.x0 + ligature_char.width/2 - .01
                ligature_char.text = ligature_char.text[0]

                ligature_char_copy2 = PDFChar(
                    x0=ligature_char.x0 + ligature_char.width/2 + .01,
                    y0=ligature_char.y0,
                    x1=original_lig_end_x,
                    y1=ligature_char.y1,
                    text=original_lig_str[1],
                    height=ligature_char.height,
                    width=ligature_char.width,
                    cropbox=ligature_char.cropbox,
                    page_number=ligature_char.page_number
                )
                ligatures_list.append(ligature_char_copy2)
            elif ligature_str_len == 3:
                # for three characters ligatures
                ligature_char.x1 = ligature_char.x0 + ligature_char.width/3 - .01
                ligature_char.text = ligature_char.text[0]

                # second char in ligature
                ligature_char_copy2 = PDFChar(
                    x0=ligature_char.x0 + ligature_char.width/3 + .01,
                    y0=ligature_char.y0,
                    x1=ligature_char.x0 + 2 * ligature_char.width/3 - .01,
                    y1=ligature_char.y1,
                    text=original_lig_str[1],
                    height=ligature_char.height,
                    width=ligature_char.width,
                    cropbox=ligature_char.cropbox,
                    page_number=ligature_char.page_number
                )
                ligatures_list.append(ligature_char_copy2)

                # third char in ligature
                ligature_char_copy3 = PDFChar(
                    x0=ligature_char.x0 + 2 * ligature_char.width/3 + .01,
                    y0=ligature_char.y0,
                    x1=original_lig_end_x,
                    y1=ligature_char.y1,
                    text=original_lig_str[-1],
                    height=ligature_char.height,
                    width=ligature_char.width,
                    cropbox=ligature_char.cropbox,
                    page_number=ligature_char.page_number
                )
                ligatures_list.append(ligature_char_copy3)
            return ligatures_list

        for lt_obj in layout:
            if isinstance(lt_obj, LTTextBox) or isinstance(lt_obj, LTTextLine) or isinstance(lt_obj, LTFigure):  # noqa
                self._get_lt_char(
                    layout=lt_obj,
                    char_coord_objs_in_pdf=char_coord_objs_in_pdf,
                    compiled_regex=compiled_regex,
                    cropbox=cropbox,
                    page_number=page_number
                )
            elif (isinstance(lt_obj, LTChar) or isinstance(lt_obj, LTAnno)) and (
                lt_obj.get_text() != '\n' and lt_obj.get_text() != '\x00'):  # noqa
                is_ltchar = isinstance(lt_obj, LTChar)
                pdf_char_obj = PDFChar(
                    x0=lt_obj.x0 if is_ltchar else 0,
                    y0=lt_obj.y0 if is_ltchar else 0,
                    x1=lt_obj.x1 if is_ltchar else 0,
                    y1=lt_obj.y1 if is_ltchar else 0,
                    text=lt_obj.get_text(),
                    height=lt_obj.height if is_ltchar else 0,
                    width=lt_obj.width if is_ltchar else 0,
                    page_number=page_number,
                    cropbox=cropbox
                )

                # ignore CID fonts
                # these are arithmetic or other symbols the parser
                # was not able to translate
                # usually requires a license or better algorithm from parser
                if not re.search(compiled_regex, pdf_char_obj.text):
                    ligatures_list: List[LTChar] = []
                    char_unicode = None

                    try:
                        char_unicode = ord(pdf_char_obj.text)
                    except Exception:
                        # pdfminer sometimes parses ligatures as actually two chars
                        # in one LTChar object
                        ligatures_list = expand_ligatures(pdf_char_obj)

                    # first check for ligatures, e.g `fi`, `ffi`, etc
                    # the ligatures are one char, so need to expand them
                    # essentially creating new chars for each supposed chars
                    # in the ligature
                    if char_unicode and char_unicode in LIGATURES:
                        decoded_str = LIGATURES[char_unicode]
                        pdf_char_obj.text = decoded_str
                        ligatures_list = expand_ligatures(pdf_char_obj)

                    if char_coord_objs_in_pdf:
                        prev_char = char_coord_objs_in_pdf[-1]

                        if should_add_virtual_space(prev_char, pdf_char_obj):
                            virtual_space_char = PDFChar(
                                x0=0, y0=0, x1=0, y1=0,
                                text=' ', height=0, width=0,
                                page_number=page_number, cropbox=cropbox, space=True)
                            char_coord_objs_in_pdf.append(virtual_space_char)
                            prev_char = virtual_space_char

                        if self._is_whitespace(char=pdf_char_obj.text):
                            if self._not_whitespace(char=prev_char.text):
                                # only append if previous is not a whitespace
                                char_coord_objs_in_pdf.append(pdf_char_obj)
                        else:
                            char_coord_objs_in_pdf.append(pdf_char_obj)
                    else:
                        char_coord_objs_in_pdf.append(pdf_char_obj)
                    if ligatures_list:
                        char_coord_objs_in_pdf.extend(ligatures_list)

    def parse_pdf_high_level(self, pdf) -> str:
        return high_level.extract_text(pdf)

    def parse_text(self, abstract: str) -> PDFParsedContent:
        """Parse a string and produces similar results to
        self.parse_pdf(). The only difference would be the PDFChar
        objects will not have actual PDF coordinates.
        """
        pdf_chars: List[PDFChar] = []

        for c in abstract:
            # create a fake PDFChar
            pdf_chars.append(
                PDFChar(
                    x0=0, y0=0, x1=0, y1=0,
                    text=c, height=0, width=0,
                    page_number=1,
                    cropbox=(1, 1),
                )
            )
        words = self._combine_chars_into_words(pdf_chars)
        return PDFParsedContent(words=words)

    def _parse_pdf_file(self, pdf) -> List[PDFChar]:
        """Parse a PDF and create two dictionaries; one
        containing individual LTChar objects with coordinate
        positions, and the other the string character representation.
        """
        parser = PDFParser(pdf)
        pdf_doc = PDFDocument(parser)
        rsrcmgr = PDFResourceManager()
        device = PDFPageAggregator(rsrcmgr=rsrcmgr, laparams=LAParams())
        interpreter = PDFPageInterpreter(rsrcmgr=rsrcmgr, device=device)

        char_coord_objs_in_pdf: List[PDFChar] = []

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
            interpreter.process_page(page)
            layout = device.get_result()
            self._get_lt_char(
                layout=layout,
                char_coord_objs_in_pdf=char_coord_objs_in_pdf,
                compiled_regex=compiled_regex,
                cropbox=(page.mediabox[0], page.mediabox[1]),
                page_number=i+1
            )

        return char_coord_objs_in_pdf

    def parse_pdf(self, pdf) -> PDFParsedContent:
        chars = self._parse_pdf_file(pdf)
        words = self._combine_chars_into_words(chars)
        return PDFParsedContent(words=words)

    def _is_whitespace(self, char: str) -> bool:
        return char in whitespace or char == '\xa0'

    def _not_whitespace(self, char: str) -> bool:
        return char not in whitespace and char != '\xa0'

    def _remove_leading_trailing_punctuation(
        self,
        word: str,
        pdf_meta: PDFMeta,
        location_offsets: List[int]
    ) -> Tuple[str, List[int], PDFMeta]:
        """Only remove balanced opening and closing punctuation.
        """
        opening_punc = {'(', '[', '{'}
        closing_punc = {')', ']', '}'}
        leading_punc = set(punctuation) - opening_punc
        trailing_punc = set(punctuation) - set.union(*[closing_punc, {'+', '-'}])  # type: ignore
        ending_punc = {'.', ',', '?', '!'}

        coordinates = pdf_meta.coordinates
        heights = pdf_meta.heights
        widths = pdf_meta.widths
        word_copy = word
        location_offsets_copy = location_offsets

        try:
            # ending punctuation
            while word_copy and word_copy[-1] in ending_punc:
                word_copy = word_copy[:-1]
                coordinates = coordinates[:-1]
                heights = heights[:-1]
                widths = widths[:-1]
                location_offsets_copy = location_offsets_copy[:-1]

            if word_copy:
                # now check for other punctuations
                # e.g (circle).
                # the period was removed in previous while block
                while word_copy and (word_copy[0] in opening_punc and word_copy[-1] in closing_punc):  # noqa
                    if word_copy[0] == '(' and word_copy[-1] == ')' or \
                        word_copy[0] == '[' and word_copy[-1] == ']' or \
                            word_copy[0] == '{' and word_copy[-1] == '}':
                        word_copy = word_copy[1:-1]
                        coordinates = coordinates[1:-1]
                        heights = heights[1:-1]
                        widths = widths[1:-1]
                        location_offsets_copy = location_offsets_copy[1:-1]
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
                            coordinates = coordinates[1:]
                            heights = heights[1:]
                            widths = widths[1:]
                            location_offsets_copy = location_offsets_copy[1:]

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
                            coordinates = coordinates[:-1]
                            heights = heights[:-1]
                            widths = widths[:-1]
                            location_offsets_copy = location_offsets_copy[:-1]

                if word_copy:
                    # strip the first leading and trailing only
                    # because can't assume any others are not
                    # part of word
                    if word_copy[-1] in trailing_punc:
                        word_copy = word_copy[:-1]
                        coordinates = coordinates[:-1]
                        heights = heights[:-1]
                        widths = widths[:-1]
                        location_offsets_copy = location_offsets_copy[:-1]
                    if word_copy and word_copy[0] in leading_punc:
                        word_copy = word_copy[1:]
                        coordinates = coordinates[1:]
                        heights = heights[1:]
                        widths = widths[1:]
                        location_offsets_copy = location_offsets_copy[1:]

        except IndexError:
            raise AnnotationError(
                'Index key error occurred when stripping leading and trailing punctuation.'
                f' For word "{word}"')

        return word_copy, location_offsets_copy, PDFMeta(
            coordinates=coordinates, heights=heights, widths=widths),

    def _combine_chars_into_words(
        self,
        parsed_chars: List[PDFChar],
    ) -> List[PDFWord]:
        """Combines a list of char into a list of words with the
        coordinates, height and width of each char in the word.

        TODO: Clean this up later!
        """
        pdf_words: List[PDFWord] = []
        max_length = len(parsed_chars)
        # does not include period
        # because they're used in initials
        ending_punc = {',', '?', '!'}

        word = ''
        pdf_meta = PDFMeta()
        page_number = None
        cropbox = None
        location_offsets: List[int] = []

        for i, char in enumerate(parsed_chars):
            if not page_number:
                page_number = char.page_number
            if not cropbox:
                cropbox = char.cropbox

            try:
                if ord(char.text) in MISC_SYMBOLS_AND_CHARS:
                    # need to clean because some times hyphens
                    # are parsed as a char that's represented by a
                    # unicode and doesn't match the string hyphen
                    curr_char = clean_char(char.text)
                else:
                    curr_char = char.text

                if ord(parsed_chars[i-1].text) in MISC_SYMBOLS_AND_CHARS:
                    prev_char = clean_char(parsed_chars[i-1].text)
                else:
                    prev_char = parsed_chars[i-1].text

                if curr_char in whitespace and prev_char != '-':
                    # signals end of a word
                    if pdf_meta.coordinates:
                        open_parenthesis = False
                        close_parenthesis = False

                        if word[0] in ascii_letters and word[-1] in ascii_letters:
                            pdf_meta.lo_location_offset = location_offsets[0]
                            pdf_meta.hi_location_offset = location_offsets[-1]
                            pdf_words.append(
                                PDFWord(
                                    keyword=word,
                                    normalized_keyword='',
                                    page_number=page_number,
                                    cropbox=cropbox,
                                    meta=pdf_meta,
                                    previous_words=' '.join(
                                        [pdfw.keyword for pdfw in pdf_words[-MAX_ABBREVIATION_WORD_LENGTH:]])  # noqa
                                        if open_parenthesis and close_parenthesis else ''  # noqa
                                )
                            )
                            word = ''
                            page_number = None
                            cropbox = None
                            location_offsets[:] = []
                            pdf_meta = PDFMeta()
                        else:
                            if len(word) == 2:
                                # skip words like E., I. etc
                                # basically initials like because
                                # some possible tokens start with those
                                if word[0] not in ascii_letters:
                                    word, location_offsets, pdf_meta = self._remove_leading_trailing_punctuation(  # noqa
                                        word=word, pdf_meta=pdf_meta,
                                        location_offsets=location_offsets
                                    )
                            else:
                                if word[0] == '(' and word[-1] == ')':
                                    open_parenthesis = True
                                    close_parenthesis = True

                                word, location_offsets, pdf_meta = self._remove_leading_trailing_punctuation(  # noqa
                                    word=word, pdf_meta=pdf_meta,
                                    location_offsets=location_offsets
                                )

                            if word and location_offsets and pdf_meta.coordinates:
                                pdf_meta.lo_location_offset = location_offsets[0]
                                pdf_meta.hi_location_offset = location_offsets[-1]
                                pdf_words.append(
                                    PDFWord(
                                        keyword=word,
                                        normalized_keyword='',
                                        page_number=page_number,
                                        cropbox=cropbox,
                                        meta=pdf_meta,
                                        previous_words=' '.join(
                                            [pdfw.keyword for pdfw in pdf_words[-MAX_ABBREVIATION_WORD_LENGTH:]])  # noqa
                                            if open_parenthesis and close_parenthesis else ''  # noqa
                                    )
                                )
                            word = ''
                            page_number = None
                            cropbox = None
                            location_offsets[:] = []
                            pdf_meta = PDFMeta()
                else:
                    open_parenthesis = False
                    close_parenthesis = False

                    if i + 1 == max_length:
                        # reached end so add whatever is left
                        if curr_char not in whitespace:
                            word += curr_char
                            pdf_meta.coordinates.append(
                                [char.x0, char.y0, char.x1, char.y1]
                            )
                            pdf_meta.heights.append(char.height)
                            pdf_meta.widths.append(char.width)
                            location_offsets.append(i)

                        if len(word) == 2:
                            # skip words like E., I. etc
                            # basically initials like because
                            # some possible tokens start with those
                            if word[0] not in ascii_letters:
                                word, location_offsets, pdf_meta = self._remove_leading_trailing_punctuation(  # noqa
                                    word=word, pdf_meta=pdf_meta,
                                    location_offsets=location_offsets
                                )
                        else:
                            if word[0] == '(' and word[-1] == ')':
                                open_parenthesis = True
                                close_parenthesis = True

                            word, location_offsets, pdf_meta = self._remove_leading_trailing_punctuation(  # noqa
                                word=word, pdf_meta=pdf_meta,
                                location_offsets=location_offsets
                            )

                        if word and location_offsets and pdf_meta.coordinates:
                            pdf_meta.lo_location_offset = location_offsets[0]
                            pdf_meta.hi_location_offset = location_offsets[-1]
                            pdf_words.append(
                                PDFWord(
                                    keyword=word,
                                    normalized_keyword='',
                                    page_number=page_number,
                                    cropbox=cropbox,
                                    meta=pdf_meta,
                                    previous_words=' '.join(
                                        [pdfw.keyword for pdfw in pdf_words[-MAX_ABBREVIATION_WORD_LENGTH:]])  # noqa
                                        if open_parenthesis and close_parenthesis else ''  # noqa
                                )
                            )
                        word = ''
                        page_number = None
                        cropbox = None
                        location_offsets[:] = []
                        pdf_meta = PDFMeta()
                    else:
                        if ord(parsed_chars[i+1].text) in MISC_SYMBOLS_AND_CHARS:  # noqa
                            next_char = clean_char(parsed_chars[i+1].text)
                        else:
                            next_char = parsed_chars[i+1].text

                        if ((curr_char == '-' and next_char in whitespace) or
                            (curr_char in whitespace and prev_char == '-') or
                            curr_char in ending_punc and next_char in whitespace):  # noqa
                            # word is possibly on new line
                            # or end of a word
                            # so ignore the space
                            continue
                        else:
                            word += curr_char
                            pdf_meta.coordinates.append(
                                [char.x0, char.y0, char.x1, char.y1]
                            )
                            pdf_meta.heights.append(char.height)
                            pdf_meta.widths.append(char.width)
                            location_offsets.append(i)
            except TypeError:
                # checking ord() failed
                continue

        return pdf_words
