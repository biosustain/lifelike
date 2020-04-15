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
