import attr

from typing import Dict, List, Union

from pdfminer.layout import LTAnno, LTChar

from neo4japp.util import CamelDictMixin


@attr.s(frozen=True)
class PDFParsedCharacters(CamelDictMixin):
    coor_obj_per_pdf_page: Dict[int, List[Union[LTChar, LTAnno]]] = attr.ib()  # noqa
    str_per_pdf_page: Dict[int, List[str]] = attr.ib()


@attr.s(frozen=True)
class PDFTokenPositions(CamelDictMixin):
    page_number: int = attr.ib()
    keyword: str = attr.ib()
    char_positions: Dict[int, str] = attr.ib()


@attr.s(frozen=True)
class PDFTokenPositionsList(CamelDictMixin):
    token_positions: List[PDFTokenPositions] = attr.ib()
    coor_obj_per_pdf_page: Dict[int, List[Union[LTChar, LTAnno]]] = attr.ib()  # noqa


# IMPORTANT NOTE/TODO: the commented out old code is there
# because we need to resolve this issue of what data
# structure to use. Up until 4/20 the commented out
# structure was used in annotations and pdf-viewer
#
# but a last minute change was done on the pdf-viewer
# and to avoid back and forth between (1) annotations,
# (2) pdf-viewer and (3) NLP, we need to settle on a format
#
# for now change to what the pdf-viewer use
@attr.s(frozen=True)
class Annotation(CamelDictMixin):
    @attr.s(frozen=True)
    class Meta(CamelDictMixin):
        @attr.s(frozen=True)
        class Links(CamelDictMixin):
            ncbi: str = attr.ib(default='')
            uniprot: str = attr.ib(default='')
            wikipedia: str = attr.ib(default='')
            google: str = attr.ib(default='')

        keyword_type: str = attr.ib()
        color: str = attr.ib()
        links: Links = attr.ib()
        id: str = attr.ib()
        id_type: str = attr.ib()
        is_custom: bool = attr.ib(default=False)
        all_text: str = attr.ib(default='')

    @attr.s(frozen=True)
    class TextPosition(CamelDictMixin):
        # [x1, y1, x2, y2]
        positions: List[float] = attr.ib()
        value: str = attr.ib()
    #     lower_left: Dict[str, float] = attr.ib()
    #     upper_right: Dict[str, float] = attr.ib()

    page_number: int = attr.ib()
    # keywords and rects are a pair
    # each index in the list correspond to the other
    keywords: List[str] = attr.ib()
    rects: List[TextPosition] = attr.ib()
    # the untouched str keyword
    keyword: str = attr.ib()
    keyword_length: int = attr.ib()
    lo_location_offset: int = attr.ib()
    hi_location_offset: int = attr.ib()
    meta: Meta = attr.ib()
