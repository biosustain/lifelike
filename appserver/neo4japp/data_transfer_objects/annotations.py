import attr

from typing import Any, Dict, List, Optional, Tuple, Union

from pdfminer.layout import LTAnno, LTChar

from neo4japp.util import CamelDictMixin


@attr.s(frozen=True)
class AnnotationRequest(CamelDictMixin):
    annotation_method: str = attr.ib()
    file_ids: List[str] = attr.ib(default=attr.Factory(list))


@attr.s(frozen=True)
class PDFParsedCharacters(CamelDictMixin):
    chars_in_pdf: List[str] = attr.ib()
    char_coord_objs_in_pdf: List[Union[LTChar, LTAnno]] = attr.ib()
    cropbox_in_pdf: Tuple[int, int] = attr.ib()
    min_idx_in_page: Dict[int, int] = attr.ib()


@attr.s(frozen=True)
class PDFTokenPositions(CamelDictMixin):
    page_number: int = attr.ib()
    keyword: str = attr.ib()
    char_positions: Dict[int, str] = attr.ib()
    # used in NLP because it returns the type
    token_type: Optional[str] = attr.ib(default='')


@attr.s(frozen=True)
class PDFTokenPositionsList(CamelDictMixin):
    token_positions: Any = attr.ib()
    char_coord_objs_in_pdf: List[Union[LTChar, LTAnno]] = attr.ib()
    cropbox_in_pdf: Tuple[int, int] = attr.ib()
    min_idx_in_page: Dict[int, int] = attr.ib()


# IMPORTANT NOTE/TODO: JIRA LL-465
# the commented out old code is there
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

        type: str = attr.ib()
        color: str = attr.ib()
        links: Links = attr.ib()
        id: str = attr.ib()
        id_type: str = attr.ib()
        id_hyperlink: str = attr.ib()
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
    # these two replaced the old lower_left/upper_right in TextPosition
    keywords: List[str] = attr.ib()
    rects: List[List[float]] = attr.ib()
    # the matched str keyword
    keyword: str = attr.ib()
    # string from document
    text_in_document: str = attr.ib()
    keyword_length: int = attr.ib()
    lo_location_offset: int = attr.ib()
    hi_location_offset: int = attr.ib()
    meta: Meta = attr.ib()
    uuid: str = attr.ib()


@attr.s(frozen=True)
class OrganismAnnotation(Annotation):
    @attr.s(frozen=True)
    class OrganismMeta(Annotation.Meta):
        category: str = attr.ib(default='')


@attr.s(frozen=True)
class GeneAnnotation(Annotation):
    @attr.s(frozen=True)
    class GeneMeta(Annotation.Meta):
        category: str = attr.ib(default='')
