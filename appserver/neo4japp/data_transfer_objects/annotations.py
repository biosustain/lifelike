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


@attr.s(frozen=True)
class Annotation(CamelDictMixin):
    @attr.s(frozen=True)
    class TextPosition(CamelDictMixin):
        value: str = attr.ib()
        lower_left: Dict[str, float] = attr.ib()
        upper_right: Dict[str, float] = attr.ib()

    page_number: int = attr.ib()
    keyword: List[TextPosition] = attr.ib()
    keyword_length: int = attr.ib()
    lo_location_offset: int = attr.ib()
    hi_location_offset: int = attr.ib()
    keyword_type: str = attr.ib()
    color: str = attr.ib()
    id: str = attr.ib()
    id_type: str = attr.ib()
