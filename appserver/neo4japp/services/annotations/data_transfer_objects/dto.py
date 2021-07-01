import attr

from typing import List, Optional, Set, Tuple

from neo4japp.util import CamelDictMixin


@attr.s(frozen=True)
class AnnotationRequest(CamelDictMixin):
    annotation_method: str = attr.ib()
    file_ids: List[str] = attr.ib(default=attr.Factory(list))
    organism: dict = attr.ib(default=attr.Factory(dict))


@attr.s(frozen=False)
class Inclusion():
    entities: List[dict] = attr.ib()
    entity_id_type: str = attr.ib()
    entity_id_hyperlink: str = attr.ib()


@attr.s(frozen=False)
class PDFBase():
    def to_dict(self):
        return attr.asdict(self)


@attr.s(frozen=True)
class NLPResults():
    anatomy: Set[Tuple[int, int]] = attr.ib(default=attr.Factory(set))
    chemicals: Set[Tuple[int, int]] = attr.ib(default=attr.Factory(set))
    compounds: Set[Tuple[int, int]] = attr.ib(default=attr.Factory(set))
    diseases: Set[Tuple[int, int]] = attr.ib(default=attr.Factory(set))
    foods: Set[Tuple[int, int]] = attr.ib(default=attr.Factory(set))
    genes: Set[Tuple[int, int]] = attr.ib(default=attr.Factory(set))
    phenomenas: Set[Tuple[int, int]] = attr.ib(default=attr.Factory(set))
    phenotypes: Set[Tuple[int, int]] = attr.ib(default=attr.Factory(set))
    proteins: Set[Tuple[int, int]] = attr.ib(default=attr.Factory(set))
    species: Set[Tuple[int, int]] = attr.ib(default=attr.Factory(set))


@attr.s(frozen=True)
class PDFWord():
    keyword: str = attr.ib()
    normalized_keyword: str = attr.ib()
    page_number: int = attr.ib()
    lo_location_offset: int = attr.ib()
    hi_location_offset: int = attr.ib()
    # used to determine abbreviations
    # if word is wrapped in parenthesis
    # this attribute will not be empty string
    previous_words: str = attr.ib()
    heights: List[float] = attr.ib(default=attr.Factory(list))
    widths: List[float] = attr.ib(default=attr.Factory(list))
    coordinates: List[List[float]] = attr.ib(default=attr.Factory(list))


@attr.s(frozen=False)
class Annotation(CamelDictMixin):
    @attr.s(frozen=False)
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
        links: Links = attr.ib()
        id: str = attr.ib()
        id_type: str = attr.ib()
        id_hyperlink: str = attr.ib()
        is_custom: bool = attr.ib(default=False)
        all_text: str = attr.ib(default='')

    @attr.s(frozen=False)
    class EnrichmentDomain():
        domain: str = attr.ib(default='')
        sub_domain: str = attr.ib(default='')

    page_number: int = attr.ib()
    # keywords and rects are a pair
    # each index in the list correspond to the other
    # the keywords attribute is only there to help with debugging the coordinates
    keywords: List[str] = attr.ib()
    rects: List[List[float]] = attr.ib()
    # the matched str keyword (synonym)
    keyword: str = attr.ib()
    # string from document
    text_in_document: str = attr.ib()
    keyword_length: int = attr.ib()
    lo_location_offset: int = attr.ib()
    hi_location_offset: int = attr.ib()
    meta: Meta = attr.ib()
    uuid: str = attr.ib()
    primary_name: str = attr.ib(default='')
    enrichment_gene: str = attr.ib(default='')
    enrichment_domain: EnrichmentDomain = attr.ib(default=attr.Factory(EnrichmentDomain))


@attr.s(frozen=False)
class OrganismAnnotation(Annotation):
    @attr.s(frozen=False)
    class OrganismMeta(Annotation.Meta):
        category: str = attr.ib(default='')


@attr.s(frozen=False)
class GeneAnnotation(Annotation):
    @attr.s(frozen=False)
    class GeneMeta(Annotation.Meta):
        category: str = attr.ib(default='')


@attr.s(frozen=False)
class LMDBMatch():
    entities: List[dict] = attr.ib()
    token: PDFWord = attr.ib()
    id_type: str = attr.ib(default='')
    id_hyperlink: str = attr.ib(default='')


@attr.s(frozen=False)
class RecognizedEntities():
    recognized_anatomy: List[LMDBMatch] = attr.ib(default=attr.Factory(list))
    recognized_chemicals: List[LMDBMatch] = attr.ib(default=attr.Factory(list))
    recognized_compounds: List[LMDBMatch] = attr.ib(default=attr.Factory(list))
    recognized_diseases: List[LMDBMatch] = attr.ib(default=attr.Factory(list))
    recognized_foods: List[LMDBMatch] = attr.ib(default=attr.Factory(list))
    recognized_genes: List[LMDBMatch] = attr.ib(default=attr.Factory(list))
    recognized_phenomenas: List[LMDBMatch] = attr.ib(default=attr.Factory(list))
    recognized_phenotypes: List[LMDBMatch] = attr.ib(default=attr.Factory(list))
    recognized_proteins: List[LMDBMatch] = attr.ib(default=attr.Factory(list))
    recognized_species: List[LMDBMatch] = attr.ib(default=attr.Factory(list))
    recognized_local_species: List[LMDBMatch] = attr.ib(default=attr.Factory(list))
    # non LMDB entity types
    recognized_companies: List[LMDBMatch] = attr.ib(default=attr.Factory(list))
    recognized_entities: List[LMDBMatch] = attr.ib(default=attr.Factory(list))


@attr.s(frozen=True)
class SpecifiedOrganismStrain():
    synonym: str = attr.ib()
    organism_id: str = attr.ib()
    category: str = attr.ib()


@attr.s(frozen=True)
class BestOrganismMatch():
    entity_id: str = attr.ib()
    organism_id: str = attr.ib()
    closest_distance: float = attr.ib()
    specified_organism_id: Optional[str] = attr.ib(default=None)
