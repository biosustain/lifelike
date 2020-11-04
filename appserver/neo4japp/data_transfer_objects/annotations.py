import attr

from typing import Any, Dict, List, Optional, Tuple

from neo4japp.util import CamelDictMixin


@attr.s(frozen=True)
class AnnotationRequest(CamelDictMixin):
    annotation_method: str = attr.ib()
    file_ids: List[str] = attr.ib(default=attr.Factory(list))
    organism: dict = attr.ib(default=attr.Factory(dict))


@attr.s(frozen=False)
class PDFChar():
    text: str = attr.ib()
    height: float = attr.ib()
    width: float = attr.ib()
    x0: float = attr.ib()
    y0: float = attr.ib()
    x1: float = attr.ib()
    y1: float = attr.ib()
    lower_cropbox: Optional[int] = attr.ib(default=None)
    upper_cropbox: Optional[int] = attr.ib(default=None)
    # min_idx_in_page: Optional[Dict[int, int]] = attr.ib(default=None)
    # TODO: figure out a better way
    # attr transforms the Dict[int, int] into Dict[str, int] with asdict()
    min_idx_in_page: Optional[str] = attr.ib(default=None)
    space: bool = attr.ib(default=False)

    def to_dict(self):
        return attr.asdict(self)


@attr.s(frozen=True)
class PDFParsedCharacters():
    chars_in_pdf: List[str] = attr.ib()
    char_coord_objs_in_pdf: List[PDFChar] = attr.ib()
    cropbox_in_pdf: Tuple[int, int] = attr.ib()
    min_idx_in_page: Dict[int, int] = attr.ib()


@attr.s(frozen=True)
class PDFTokenPositions():
    page_number: int = attr.ib()
    keyword: str = attr.ib()
    normalized_keyword: str = attr.ib()
    char_positions: Dict[int, str] = attr.ib()
    # used in NLP because it returns the type
    token_type: Optional[str] = attr.ib(default='')


@attr.s(frozen=True)
class PDFTokenPositionsList():
    token_positions: Any = attr.ib()
    char_coord_objs_in_pdf: List[PDFChar] = attr.ib()
    cropbox_in_pdf: Tuple[int, int] = attr.ib()
    min_idx_in_page: Dict[int, int] = attr.ib()
    word_index_dict: Dict[int, str] = attr.ib(default=attr.Factory(list))


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
            mesh: str = attr.ib(default='')
            chebi: str = attr.ib(default='')
            pubchem: str = attr.ib(default='')
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


@attr.s(frozen=False)
class LMDBMatch():
    entities: List[dict] = attr.ib()
    tokens: List[PDFTokenPositions] = attr.ib()


@attr.s(frozen=True)
class EntityResults():
    matched_anatomy: Dict[str, LMDBMatch] = attr.ib()
    matched_chemicals: Dict[str, LMDBMatch] = attr.ib()
    matched_compounds: Dict[str, LMDBMatch] = attr.ib()
    matched_diseases: Dict[str, LMDBMatch] = attr.ib()
    matched_foods: Dict[str, LMDBMatch] = attr.ib()
    matched_genes: Dict[str, LMDBMatch] = attr.ib()
    matched_phenotypes: Dict[str, LMDBMatch] = attr.ib()
    matched_proteins: Dict[str, LMDBMatch] = attr.ib()
    matched_species: Dict[str, LMDBMatch] = attr.ib()


@attr.s(frozen=True)
class SpecifiedOrganismStrain():
    synonym: str = attr.ib()
    organism_id: str = attr.ib()
    category: str = attr.ib()
