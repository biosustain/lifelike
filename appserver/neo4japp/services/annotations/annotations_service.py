import json
import re
import requests

from collections import deque
from math import inf
from typing import cast, Dict, List, Optional, Set, Tuple, Union
from uuid import uuid4

from pdfminer.layout import LTAnno, LTChar

from .annotation_interval_tree import (
    AnnotationInterval,
    AnnotationIntervalTree,
)
from .annotations_neo4j_service import AnnotationsNeo4jService
from .constants import (
    DatabaseType,
    EntityColor,
    EntityIdStr,
    EntityType,
    OrganismCategory,
    # exclusion lists
    # CHEMICAL_EXCLUSION,
    # COMPOUND_EXCLUSION,
    SPECIES_EXCLUSION,
    # end exclusion lists
    ENTITY_HYPERLINKS,
    ENTITY_TYPE_PRECEDENCE,
    GOOGLE_LINK,
    HOMO_SAPIENS_TAX_ID,
    NCBI_LINK,
    PDF_NEW_LINE_THRESHOLD,
    COMMON_TYPOS,
    UNIPROT_LINK,
    WIKIPEDIA_LINK,
    # LOWERCASE_FIRST_LETTER_UPPERCASE_LAST_LETTER_GENE_LENGTH,
    NLP_ENDPOINT,
)
from .lmdb_dao import LMDBDao
from .util import normalize_str

from neo4japp.data_transfer_objects import (
    Annotation,
    GeneAnnotation,
    OrganismAnnotation,
    PDFParsedCharacters,
    PDFTokenPositions,
    PDFTokenPositionsList,
)
from neo4japp.exceptions import AnnotationError
from neo4japp.models import AnnotationStopWords


class AnnotationsService:
    def __init__(
        self,
        lmdb_session: LMDBDao,
        annotation_neo4j: AnnotationsNeo4jService,
    ) -> None:
        self.lmdb_session = lmdb_session
        self.annotation_neo4j = annotation_neo4j

        # for word tokens that are typos
        self.correct_spellings: Dict[str, str] = {}

        # custom annotations, including inclusion and exclusions
        # use in memory dict because they should be small
        # should be init when needed
        self._custom_species = None

        self.matched_genes: Dict[str, List[PDFTokenPositions]] = {}
        self.matched_chemicals: Dict[str, List[PDFTokenPositions]] = {}
        self.matched_compounds: Dict[str, List[PDFTokenPositions]] = {}
        self.matched_proteins: Dict[str, List[PDFTokenPositions]] = {}
        self.matched_species: Dict[str, List[PDFTokenPositions]] = {}
        self.matched_custom_species: Dict[str, List[PDFTokenPositions]] = {}
        self.matched_diseases: Dict[str, List[PDFTokenPositions]] = {}
        self.matched_phenotypes: Dict[str, List[PDFTokenPositions]] = {}

        self.organism_frequency: Dict[str, int] = {}
        self.organism_locations: Dict[str, List[Tuple[int, int]]] = {}
        self.organism_categories: Dict[str, str] = {}

        # TODO: could potentially put into a cache if these words will not be updated
        # often. But future feature will allow users to upload and add
        # to this list, so that means would have to recache.
        # leave as is for now?
        self.exclusion_words = set(
            result.word for result in self.annotation_neo4j.session.query(
                AnnotationStopWords).all())

    @property
    def custom_species(self):
        return self._custom_species

    @custom_species.setter
    def custom_species(self, value):
        self._custom_species = value

    def validate_chemicals_lmdb(
        self,
        token: PDFTokenPositions,
        synonym: Optional[str] = None,
    ):
        """Validate the lookup key exists in chemicals LMDB. If it
        does, then add it as a match.

        A key could have multiple values, but just need to check
        if one value exists because just validating if in lmdb.

        Args:
            token: the token with pdf text and it's positions
            synonym: the correct spelling (if word is misspelled)
        """
        chem_val = None
        nlp_predicted_type = None

        if token.token_type:
            nlp_predicted_type = token.token_type

        if synonym:
            lookup_key = normalize_str(synonym).encode('utf-8')
        else:
            lookup_key = normalize_str(token.keyword).encode('utf-8')

        lowered_word = token.keyword.lower()

        if len(lookup_key) > 2:
            # check chemical
            if nlp_predicted_type:
                if nlp_predicted_type == EntityType.Chemical.value and lowered_word not in self.exclusion_words:  # noqa
                    chem_val = self.lmdb_session.chemicals_txn.get(lookup_key)
            else:
                if lowered_word not in self.exclusion_words:
                    chem_val = self.lmdb_session.chemicals_txn.get(lookup_key)

            if chem_val:
                if token.keyword in self.matched_chemicals:
                    self.matched_chemicals[token.keyword].append(token)
                else:
                    self.matched_chemicals[token.keyword] = [token]

            return chem_val

    def validate_compounds_lmdb(
        self,
        token: PDFTokenPositions,
        synonym: Optional[str] = None,
    ):
        """Validate the lookup key exists in compounds LMDB. If it
        does, then add it as a match.

        A key could have multiple values, but just need to check
        if one value exists because just validating if in lmdb.

        Args:
            token: the token with pdf text and it's positions
            synonym: the correct spelling (if word is misspelled)
        """
        comp_val = None
        nlp_predicted_type = None

        if token.token_type:
            nlp_predicted_type = token.token_type

        if synonym:
            lookup_key = normalize_str(synonym).encode('utf-8')
        else:
            lookup_key = normalize_str(token.keyword).encode('utf-8')

        lowered_word = token.keyword.lower()

        if len(lookup_key) > 2:
            # check compound
            if nlp_predicted_type:
                if nlp_predicted_type == EntityType.Compound.value and lowered_word not in self.exclusion_words:  # noqa
                    comp_val = self.lmdb_session.compounds_txn.get(lookup_key)
            else:
                if lowered_word not in self.exclusion_words:
                    comp_val = self.lmdb_session.compounds_txn.get(lookup_key)

            if comp_val:
                if token.keyword in self.matched_compounds:
                    self.matched_compounds[token.keyword].append(token)
                else:
                    self.matched_compounds[token.keyword] = [token]

            return comp_val

    def validate_diseases_lmdb(
        self,
        token: PDFTokenPositions,
        synonym: Optional[str] = None,
    ):
        """Validate the lookup key exists in diseases LMDB. If it
        does, then add it as a match.

        A key could have multiple values, but just need to check
        if one value exists because just validating if in lmdb.

        Args:
            token: the token with pdf text and it's positions
            synonym: the correct spelling (if word is misspelled)
        """
        diseases_val = None
        nlp_predicted_type = None

        if token.token_type:
            nlp_predicted_type = token.token_type

        if synonym:
            lookup_key = normalize_str(synonym).encode('utf-8')
        else:
            lookup_key = normalize_str(token.keyword).encode('utf-8')

        lowered_word = token.keyword.lower()

        if len(lookup_key) > 2:
            # check disease
            if nlp_predicted_type:
                if nlp_predicted_type == EntityType.Disease.value and lowered_word not in self.exclusion_words:  # noqa
                    diseases_val = self.lmdb_session.diseases_txn.get(lookup_key)
            else:
                if lowered_word not in self.exclusion_words:
                    diseases_val = self.lmdb_session.diseases_txn.get(lookup_key)

            if diseases_val:
                if token.keyword in self.matched_diseases:
                    self.matched_diseases[token.keyword].append(token)
                else:
                    self.matched_diseases[token.keyword] = [token]

            return diseases_val

    def validate_genes_lmdb(
        self,
        token: PDFTokenPositions,
        synonym: Optional[str] = None,
    ):
        """Validate the lookup key exists in genes LMDB. If it
        does, then add it as a match.

        A key could have multiple values, but just need to check
        if one value exists because just validating if in lmdb.

        Args:
            token: the token with pdf text and it's positions
            synonym: the correct spelling (if word is misspelled)
        """
        gene_val = None
        nlp_predicted_type = None

        if token.token_type:
            nlp_predicted_type = token.token_type

        if synonym:
            lookup_key = normalize_str(synonym).encode('utf-8')
        else:
            lookup_key = normalize_str(token.keyword).encode('utf-8')

        lowered_word = token.keyword.lower()

        if len(lookup_key) > 2:
            # check gene
            if nlp_predicted_type:
                if nlp_predicted_type == EntityType.Gene.value and lowered_word not in self.exclusion_words:  # noqa
                    gene_val = self.lmdb_session.genes_txn.get(lookup_key)
            else:
                if lowered_word not in self.exclusion_words:
                    gene_val = self.lmdb_session.genes_txn.get(lookup_key)

            if gene_val:
                if token.keyword in self.matched_genes:
                    self.matched_genes[token.keyword].append(token)
                else:
                    self.matched_genes[token.keyword] = [token]

            return gene_val

    def validate_phenotypes_lmdb(
        self,
        token: PDFTokenPositions,
        synonym: Optional[str] = None,
    ):
        """Validate the lookup key exists in phenotypes LMDB. If it
        does, then add it as a match.

        A key could have multiple values, but just need to check
        if one value exists because just validating if in lmdb.

        Args:
            token: the token with pdf text and it's positions
            synonym: the correct spelling (if word is misspelled)
        """
        phenotype_val = None
        nlp_predicted_type = None

        if token.token_type:
            nlp_predicted_type = token.token_type

        if synonym:
            lookup_key = normalize_str(synonym).encode('utf-8')
        else:
            lookup_key = normalize_str(token.keyword).encode('utf-8')

        lowered_word = token.keyword.lower()

        if len(lookup_key) > 2:
            # check phenotype
            if nlp_predicted_type:
                if nlp_predicted_type == EntityType.Phenotype.value and lowered_word not in self.exclusion_words:  # noqa
                    phenotype_val = self.lmdb_session.phenotypes_txn.get(lookup_key)
            else:
                if lowered_word not in self.exclusion_words:
                    phenotype_val = self.lmdb_session.phenotypes_txn.get(lookup_key)

            if phenotype_val:
                if token.keyword in self.matched_phenotypes:
                    self.matched_phenotypes[token.keyword].append(token)
                else:
                    self.matched_phenotypes[token.keyword] = [token]

            return phenotype_val

    def validate_proteins_lmdb(
        self,
        token: PDFTokenPositions,
        synonym: Optional[str] = None,
    ):
        """Validate the lookup key exists in proteins LMDB. If it
        does, then add it as a match.

        A key could have multiple values, but just need to check
        if one value exists because just validating if in lmdb.

        Args:
            token: the token with pdf text and it's positions
            synonym: the correct spelling (if word is misspelled)
        """
        protein_val = None
        nlp_predicted_type = None

        if token.token_type:
            nlp_predicted_type = token.token_type

        if synonym:
            lookup_key = normalize_str(synonym).encode('utf-8')
        else:
            lookup_key = normalize_str(token.keyword).encode('utf-8')

        lowered_word = token.keyword.lower()

        if len(lookup_key) > 2:
            # check protein
            if nlp_predicted_type:
                if nlp_predicted_type == EntityType.Protein.value and lowered_word not in self.exclusion_words:  # noqa
                    protein_val = self.lmdb_session.proteins_txn.get(lookup_key)
            else:
                if lowered_word not in self.exclusion_words:
                    protein_val = self.lmdb_session.proteins_txn.get(lookup_key)

            if protein_val:
                if token.keyword in self.matched_proteins:
                    self.matched_proteins[token.keyword].append(token)
                else:
                    self.matched_proteins[token.keyword] = [token]

            return protein_val

    def validate_species_lmdb(
        self,
        token: PDFTokenPositions,
        synonym: Optional[str] = None,
    ):
        """Validate the lookup key exists in species LMDB. If it
        does, then add it as a match. Also validate in custom species.

        A key could have multiple values, but just need to check
        if one value exists because just validating if in lmdb.

        Args:
            token: the token with pdf text and it's positions
            synonym: the correct spelling (if word is misspelled)
        """
        species_val = None
        nlp_predicted_type = None

        if token.token_type:
            nlp_predicted_type = token.token_type

        if synonym:
            lookup_key = normalize_str(synonym).encode('utf-8')
        else:
            lookup_key = normalize_str(token.keyword).encode('utf-8')

        lowered_word = token.keyword.lower()

        if len(lookup_key) > 2:
            # check species
            if nlp_predicted_type:
                # TODO: Bacteria because for now NLP has that instead of
                # generic `Species`
                if ((nlp_predicted_type == EntityType.Species.value or
                    nlp_predicted_type == 'Bacteria') and
                        lowered_word not in SPECIES_EXCLUSION):  # noqa
                    species_val = self.lmdb_session.species_txn.get(lookup_key)
            else:
                if lowered_word not in SPECIES_EXCLUSION:
                    species_val = self.lmdb_session.species_txn.get(lookup_key)

            if species_val:
                if token.keyword in self.matched_species:
                    self.matched_species[token.keyword].append(token)
                else:
                    self.matched_species[token.keyword] = [token]
            else:
                if self.custom_species and lowered_word not in SPECIES_EXCLUSION and token.keyword in self.custom_species:  # noqa
                    if token.keyword in self.matched_custom_species:
                        self.matched_custom_species[token.keyword].append(token)
                    else:
                        self.matched_custom_species[token.keyword] = [token]

            return species_val

    def _find_lmdb_match(self, token: PDFTokenPositions, check_entities: Dict[str, bool]) -> None:
        if check_entities[EntityType.Chemical.value]:
            self._find_chemical_match(token)

        if check_entities[EntityType.Compound.value]:
            self._find_compound_match(token)

        if check_entities[EntityType.Disease.value]:
            self._find_disease_match(token)

        if check_entities[EntityType.Gene.value]:
            self._find_gene_match(token)

        if check_entities[EntityType.Phenotype.value]:
            self._find_phenotype_match(token)

        if check_entities[EntityType.Protein.value]:
            self._find_protein_match(token)

        if check_entities[EntityType.Species.value]:
            self._find_species_match(token)

    def _find_chemical_match(self, token: PDFTokenPositions) -> None:
        word = token.keyword
        if word:
            if word in COMMON_TYPOS:
                for correct_spelling in COMMON_TYPOS[word]:
                    exist = self.validate_chemicals_lmdb(
                        token=token,
                        synonym=correct_spelling,
                    )

                    # if any that means there was a match
                    # so save the correct spelling
                    if exist is not None:
                        self.correct_spellings[word] = correct_spelling
                        break
            else:
                self.validate_chemicals_lmdb(
                    token=token,
                )

    def _find_compound_match(self, token: PDFTokenPositions) -> None:
        word = token.keyword
        if word:
            if word in COMMON_TYPOS:
                for correct_spelling in COMMON_TYPOS[word]:
                    exist = self.validate_compounds_lmdb(
                        token=token,
                        synonym=correct_spelling,
                    )

                    # if any that means there was a match
                    # so save the correct spelling
                    if exist is not None:
                        self.correct_spellings[word] = correct_spelling
                        break
            else:
                self.validate_compounds_lmdb(
                    token=token,
                )

    def _find_disease_match(self, token: PDFTokenPositions) -> None:
        word = token.keyword
        if word:
            if word in COMMON_TYPOS:
                for correct_spelling in COMMON_TYPOS[word]:
                    exist = self.validate_diseases_lmdb(
                        token=token,
                        synonym=correct_spelling,
                    )

                    # if any that means there was a match
                    # so save the correct spelling
                    if exist is not None:
                        self.correct_spellings[word] = correct_spelling
                        break
            else:
                self.validate_diseases_lmdb(
                    token=token,
                )

    def _find_gene_match(self, token: PDFTokenPositions) -> None:
        word = token.keyword
        if word:
            if word in COMMON_TYPOS:
                for correct_spelling in COMMON_TYPOS[word]:
                    exist = self.validate_genes_lmdb(
                        token=token,
                        synonym=correct_spelling,
                    )

                    # if any that means there was a match
                    # so save the correct spelling
                    if exist is not None:
                        self.correct_spellings[word] = correct_spelling
                        break
            else:
                self.validate_genes_lmdb(
                    token=token,
                )

    def _find_phenotype_match(self, token: PDFTokenPositions) -> None:
        word = token.keyword
        if word:
            if word in COMMON_TYPOS:
                for correct_spelling in COMMON_TYPOS[word]:
                    exist = self.validate_phenotypes_lmdb(
                        token=token,
                        synonym=correct_spelling,
                    )

                    # if any that means there was a match
                    # so save the correct spelling
                    if exist is not None:
                        self.correct_spellings[word] = correct_spelling
                        break
            else:
                self.validate_phenotypes_lmdb(
                    token=token,
                )

    def _find_protein_match(self, token: PDFTokenPositions) -> None:
        word = token.keyword
        if word:
            if word in COMMON_TYPOS:
                for correct_spelling in COMMON_TYPOS[word]:
                    exist = self.validate_proteins_lmdb(
                        token=token,
                        synonym=correct_spelling,
                    )

                    # if any that means there was a match
                    # so save the correct spelling
                    if exist is not None:
                        self.correct_spellings[word] = correct_spelling
                        break
            else:
                self.validate_proteins_lmdb(
                    token=token,
                )

    def _find_species_match(self, token: PDFTokenPositions) -> None:
        word = token.keyword
        if word:
            if word in COMMON_TYPOS:
                for correct_spelling in COMMON_TYPOS[word]:
                    exist = self.validate_species_lmdb(
                        token=token,
                        synonym=correct_spelling,
                    )

                    # if any that means there was a match
                    # so save the correct spelling
                    if exist is not None:
                        self.correct_spellings[word] = correct_spelling
                        break
            else:
                self.validate_species_lmdb(
                    token=token,
                )

    def _create_keyword_objects(
        self,
        curr_page_coor_obj: List[Union[LTChar, LTAnno]],
        indexes: List[int],
        cropbox: Tuple[int, int],
        keyword_positions: List[Annotation.TextPosition] = [],
    ) -> None:
        """Creates the keyword objects with the keyword
        text, along with their coordinate positions and
        page number.

        Determines whether a part of the keyword is on a
        new line or not. If it is on a new line, then
        create a new coordinate object for that part of the keyword.

        E.g
            E. \nColi -> [
                {keyword: 'E.', x: ..., ...}, keyword: 'Coli', x: ..., ...}
            ]

            E. Coli -> [{keyword: 'E. Coli', x: ..., ...}]
        """
        def _skip_lt_anno(
            curr_page_coor_obj: List[Union[LTChar, LTAnno]],
            pos_idx: int,
        ) -> int:
            i = pos_idx
            while i >= 0 and isinstance(curr_page_coor_obj[i], LTAnno):
                i -= 1
            return i

        start_lower_x = None
        start_lower_y = None
        end_upper_x = None
        end_upper_y = None

        keyword = ''
        for i, pos_idx in enumerate(indexes):
            try:
                if isinstance(curr_page_coor_obj[pos_idx], LTChar):
                    lower_x, lower_y, upper_x, upper_y = curr_page_coor_obj[pos_idx].bbox  # noqa

                    if (start_lower_x is None and
                            start_lower_y is None and
                            end_upper_x is None and
                            end_upper_y is None):
                        start_lower_x = lower_x
                        start_lower_y = lower_y
                        end_upper_x = upper_x
                        end_upper_y = upper_y

                        keyword += curr_page_coor_obj[pos_idx].get_text()
                    else:
                        if lower_y != start_lower_y:
                            diff = abs(lower_y - start_lower_y)
                            prev_idx = _skip_lt_anno(
                                curr_page_coor_obj=curr_page_coor_obj,
                                pos_idx=pos_idx-1,
                            )
                            height = curr_page_coor_obj[prev_idx].height

                            # if diff is greater than height ratio
                            # then part of keyword is on a new line
                            if diff > height * PDF_NEW_LINE_THRESHOLD:
                                self._create_keyword_objects(
                                    curr_page_coor_obj=curr_page_coor_obj,
                                    indexes=indexes[i:],
                                    keyword_positions=keyword_positions,
                                    cropbox=cropbox,
                                )
                                break
                            else:
                                if upper_y > end_upper_y:
                                    end_upper_y = upper_y

                                if upper_x > end_upper_x:
                                    end_upper_x = upper_x

                                keyword += curr_page_coor_obj[pos_idx].get_text()
                        else:
                            if upper_y > end_upper_y:
                                end_upper_y = upper_y

                            if upper_x > end_upper_x:
                                end_upper_x = upper_x

                            keyword += curr_page_coor_obj[pos_idx].get_text()
            except Exception as exc:
                raise AnnotationError(
                    'Unexpected error when creating annotation keyword objects', [str(exc)])

        start_lower_x += cropbox[0]  # type: ignore
        end_upper_x += cropbox[0]  # type: ignore
        start_lower_y += cropbox[1]  # type: ignore
        end_upper_y += cropbox[1]  # type: ignore

        keyword_positions.append(
            Annotation.TextPosition(
                value=keyword,
                positions=[
                    start_lower_x, start_lower_y, end_upper_x, end_upper_y],  # type: ignore
            )
        )

    def _create_annotation_object(
        self,
        token_positions: PDFTokenPositions,
        char_coord_objs_in_pdf: List[Union[LTChar, LTAnno]],
        cropbox_in_pdf: Tuple[int, int],
        token_type: str,
        entity: dict,
        entity_id: str,
        entity_category: Optional[str],
        color: str,
        correct_spellings: Dict[str, str],
    ) -> Annotation:
        curr_page_coor_obj = char_coord_objs_in_pdf
        cropbox = cropbox_in_pdf

        keyword_positions: List[Annotation.TextPosition] = []
        char_indexes = list(token_positions.char_positions.keys())

        self._create_keyword_objects(
            curr_page_coor_obj=curr_page_coor_obj,
            indexes=char_indexes,
            keyword_positions=keyword_positions,
            cropbox=cropbox,
        )

        keyword_starting_idx = char_indexes[0]
        keyword_ending_idx = char_indexes[-1]
        link_search_term = entity['synonym']
        if entity['id_type'] != DatabaseType.Ncbi.value:
            hyperlink = ENTITY_HYPERLINKS[entity['id_type']]
        else:
            # type ignore, see https://github.com/python/mypy/issues/8277
            hyperlink = ENTITY_HYPERLINKS[entity['id_type']][token_type]  # type: ignore

        if entity['id_type'] == DatabaseType.Mesh.value:
            hyperlink += entity_id[5:]  # type: ignore
        else:
            hyperlink += entity_id  # type: ignore

        if token_type == EntityType.Species.value:
            organism_meta = OrganismAnnotation.OrganismMeta(
                category=entity_category or '',
                type=token_type,
                color=color,
                id=entity_id,
                id_type=entity['id_type'],
                id_hyperlink=cast(str, hyperlink),
                links=OrganismAnnotation.OrganismMeta.Links(
                    ncbi=NCBI_LINK + link_search_term,
                    uniprot=UNIPROT_LINK + link_search_term,
                    wikipedia=WIKIPEDIA_LINK + link_search_term,
                    google=GOOGLE_LINK + link_search_term,
                ),
                all_text=link_search_term,
            )
            # the `keywords` property here is to allow us to know
            # what coordinates map to what text in the PDF
            # we want to actually use the real name inside LMDB
            # for the `keyword` property
            annotation = OrganismAnnotation(
                page_number=token_positions.page_number,
                rects=[pos.positions for pos in keyword_positions],  # type: ignore
                keywords=[k.value for k in keyword_positions],
                keyword=link_search_term,
                text_in_document=token_positions.keyword,
                keyword_length=len(token_positions.keyword),
                lo_location_offset=keyword_starting_idx,
                hi_location_offset=keyword_ending_idx,
                meta=organism_meta,
                uuid=str(uuid4()),
            )
        elif token_type == EntityType.Gene.value:
            gene_meta = GeneAnnotation.GeneMeta(
                category=entity_category or '',
                type=token_type,
                color=color,
                id=entity_id,
                id_type=entity['id_type'],
                id_hyperlink=cast(str, hyperlink),
                links=OrganismAnnotation.OrganismMeta.Links(
                    ncbi=NCBI_LINK + link_search_term,
                    uniprot=UNIPROT_LINK + link_search_term,
                    wikipedia=WIKIPEDIA_LINK + link_search_term,
                    google=GOOGLE_LINK + link_search_term,
                ),
                all_text=link_search_term,
            )
            annotation = GeneAnnotation(
                page_number=token_positions.page_number,
                rects=[pos.positions for pos in keyword_positions],  # type: ignore
                keywords=[k.value for k in keyword_positions],
                keyword=link_search_term,
                text_in_document=token_positions.keyword,
                keyword_length=len(token_positions.keyword),
                lo_location_offset=keyword_starting_idx,
                hi_location_offset=keyword_ending_idx,
                meta=gene_meta,
                uuid=str(uuid4()),
            )
        else:
            meta = Annotation.Meta(
                type=token_type,
                color=color,
                id=entity_id,
                id_type=entity['id_type'],
                id_hyperlink=cast(str, hyperlink),
                links=Annotation.Meta.Links(
                    ncbi=NCBI_LINK + link_search_term,
                    uniprot=UNIPROT_LINK + link_search_term,
                    wikipedia=WIKIPEDIA_LINK + link_search_term,
                    google=GOOGLE_LINK + link_search_term,
                ),
                all_text=link_search_term,
            )
            annotation = Annotation(
                page_number=token_positions.page_number,
                rects=[pos.positions for pos in keyword_positions],  # type: ignore
                keywords=[k.value for k in keyword_positions],
                keyword=link_search_term,
                text_in_document=token_positions.keyword,
                keyword_length=len(token_positions.keyword),
                lo_location_offset=keyword_starting_idx,
                hi_location_offset=keyword_ending_idx,
                meta=meta,
                uuid=str(uuid4()),
            )
        return annotation

    def _get_annotation(
        self,
        tokens: Dict[str, List[PDFTokenPositions]],
        token_type: str,
        color: str,
        transaction,
        id_str: str,
        correct_spellings: Dict[str, str],
        char_coord_objs_in_pdf: List[Union[LTChar, LTAnno]],
        cropbox_in_pdf: Tuple[int, int],
    ) -> List[Annotation]:
        """Create annotation objects for tokens.

        Assumption:
            - An entity in LMDB will always have a common name and synonym
                (1) this means a common name will have itself as a synonym

        Algorithm:
            - Normalize the tokens and consider correct spelling
            - Handle common synonyms across multiple common names, because
              cannot infer entity.
                (1) if none of the common names appears, then ignore synonym
                (2) if more than one common name appears, then ignore synonym
                (3) if only one common name appears, identify synonym as entity of common name
            - NOTE: The above DOES NOT apply to synonyms that HAVE ONLY ONE common name
                (1) so if a synonym appears but its common name does not, the synonym
                will be in annotations

            - TODO: Considerations:
                (1) A synonym that is also a common name, and the other common name appears
                    (1a) how to handle? Currently ignore synonym because can't infer (?)

        Returns list of matched annotations
        """
        matches: List[Annotation] = []
        tokens_lowercased = set([normalize_str(s) for s in list(tokens.keys())])

        for word, token_positions_list in tokens.items():
            for token_positions in token_positions_list:
                if word in correct_spellings:
                    lookup_key = correct_spellings[word]
                else:
                    lookup_key = word

                lookup_key = normalize_str(lookup_key)
                entities = self.lmdb_session.get_lmdb_values(
                    txn=transaction, key=lookup_key, token_type=token_type)
                synonym_common_names_dict: Dict[str, Set[str]] = {}

                for entity in entities:
                    entity_synonym = entity['synonym']
                    entity_common_name = entity['name']
                    if entity_synonym in synonym_common_names_dict:
                        synonym_common_names_dict[entity_synonym].add(normalize_str(entity_common_name))  # noqa
                    else:
                        synonym_common_names_dict[entity_synonym] = {normalize_str(entity_common_name)}  # noqa

                for entity in entities:
                    entity_synonym = entity['synonym']
                    common_names_referenced_by_synonym = synonym_common_names_dict[entity_synonym]
                    if len(common_names_referenced_by_synonym) > 1:
                        # synonym used by multiple different common names
                        #
                        # for synonyms that are used by more than one common names
                        # if none of those common names appear in the document
                        # or if more than one of those common names appear in the document
                        # do not annotate because cannot infer
                        common_names_in_document = [n for n in common_names_referenced_by_synonym if n in tokens_lowercased]  # noqa

                        if len(common_names_in_document) != 1:
                            continue

                    annotation = self._create_annotation_object(
                        char_coord_objs_in_pdf=char_coord_objs_in_pdf,
                        cropbox_in_pdf=cropbox_in_pdf,
                        token_positions=token_positions,
                        token_type=token_type,
                        entity=entity,
                        entity_id=entity[id_str],
                        entity_category=entity.get('category', None),
                        color=color,
                        correct_spellings=correct_spellings,
                    )
                    matches.append(annotation)
        return matches

    def _get_closest_gene_organism_pair(
        self,
        gene_position: PDFTokenPositions,
        organism_matches: Dict[str, str],
    ) -> Tuple[str, str]:
        """Gets the correct gene/organism pair for a given gene and its list of matching organisms.

        A gene name may match multiple organisms. To choose which organism to use, we first
        check for the closest one in the document. If two organisms are equal in distance,
        we choose the one that appears most frequently in the document. If the two organisms
        are both equidistant and equally frequent, we always prefer homo sapiens if it is
        either of the two genes. Otherwise, we choose the one we matched first.
        """

        char_indexes = list(gene_position.char_positions.keys())
        gene_location_lo = char_indexes[0]
        gene_location_hi = char_indexes[-1]

        closest_dist = inf
        curr_closest_organism = None
        for organism in organism_matches:
            if curr_closest_organism is None:
                curr_closest_organism = organism

            min_organism_dist = inf

            # Get the closest instance of this organism
            for organism_pos in self.organism_locations[organism]:
                organism_location_lo = organism_pos[0]
                organism_location_hi = organism_pos[1]

                if gene_location_lo > organism_location_hi:
                    new_organism_dist = gene_location_lo - organism_location_hi
                else:
                    new_organism_dist = organism_location_lo - gene_location_hi

                if new_organism_dist < min_organism_dist:
                    min_organism_dist = new_organism_dist

            # If this organism is closer than the current closest, update
            if min_organism_dist < closest_dist:
                curr_closest_organism = organism
                closest_dist = min_organism_dist
            # If this organism is equidistant to the current closest, check frequency instead
            elif min_organism_dist == closest_dist:
                # If the frequency of this organism is greater, update
                if self.organism_frequency[organism] > self.organism_frequency[curr_closest_organism]:  # noqa
                    curr_closest_organism = organism
                elif self.organism_frequency[organism] == self.organism_frequency[curr_closest_organism]:  # noqa
                    # If the organisms are equidistant and equal frequency,
                    # check if the new organism is human, and if so update
                    if organism == HOMO_SAPIENS_TAX_ID:
                        curr_closest_organism = organism

        if curr_closest_organism is None:
            raise ValueError('Cannot get gene ID with empty organism match dict.')

        # Return the gene id of the organism with the highest priority
        return organism_matches[curr_closest_organism], curr_closest_organism

    def _annotate_genes(
        self,
        entity_id_str: str,
        char_coord_objs_in_pdf: List[Union[LTChar, LTAnno]],
        cropbox_in_pdf: Tuple[int, int],
        organisms_from_custom_annotations: Set[str],
    ) -> List[Annotation]:
        """Gene specific annotation. Nearly identical to `_get_annotation`,
        except that we check genes against the matched organisms found in the
        document.

        It is likely that the annotator will detect keywords that resemble gene
        names, but are not genes in the context of the document.

        It is also possible that two organisms discussed in the document each have a
        gene with the same name. In this case we need a way to distinguish between the
        two.

        To resolve both of the above issues we check the graph database for
        relationships between genes/organisms, and handle each of the following cases:
            1. Exactly one organism match for a given gene
            2. More than one organism match for a given gene
            3. No organism matches for a given gene

        Returns list of matched annotations
        """
        tokens: Dict[str, List[PDFTokenPositions]] = self.matched_genes
        transaction = self.lmdb_session.genes_txn
        correct_spellings: Dict[str, str] = self.correct_spellings

        matches: List[Annotation] = []

        entity_tokenpos_pairs = []
        gene_names: Set[str] = set()
        for word, token_positions_list in tokens.items():
            for token_positions in token_positions_list:
                if word in correct_spellings:
                    lookup_key = correct_spellings[word]
                else:
                    lookup_key = word

                lookup_key = normalize_str(lookup_key)
                entities = self.lmdb_session.get_lmdb_values(
                    txn=transaction, key=lookup_key, token_type=EntityType.Gene.value)

                # for genes we can be more strict and check for exact match
                # if there are exact matches we want those and ignore the others
                entities_to_use = [entity for entity in entities if entity['synonym'] == word]

                if len(entities_to_use) == 0:
                    entities_to_use = entities

                for entity in entities_to_use:
                    entity_synonym = entity['synonym']
                    gene_names.add(entity_synonym)

                    entity_tokenpos_pairs.append((entity, token_positions))

        organism_ids_from_custom_annotations = self.annotation_neo4j.get_organisms_from_ids(
            tax_ids=list(organisms_from_custom_annotations))

        organism_ids_to_query = organism_ids_from_custom_annotations + list(self.organism_frequency.keys())  # noqa

        gene_organism_matches = \
            self.annotation_neo4j.get_gene_to_organism_match_result(
                genes=list(gene_names),
                matched_organism_ids=organism_ids_to_query,
            )

        for entity, token_positions in entity_tokenpos_pairs:
            if entity['name'] in gene_organism_matches:
                gene_id, organism_id = self._get_closest_gene_organism_pair(
                    gene_position=token_positions,
                    organism_matches=gene_organism_matches[entity['name']]
                )

                category = self.organism_categories[organism_id]

                annotation = self._create_annotation_object(
                    char_coord_objs_in_pdf=char_coord_objs_in_pdf,
                    cropbox_in_pdf=cropbox_in_pdf,
                    token_positions=token_positions,
                    token_type=EntityType.Gene.value,
                    entity=entity,
                    entity_id=gene_id,
                    entity_category=category,
                    color=EntityColor.Gene.value,
                    correct_spellings=correct_spellings,
                )
                matches.append(annotation)
        return matches

    def _annotate_chemicals(
        self,
        entity_id_str: str,
        char_coord_objs_in_pdf: List[Union[LTChar, LTAnno]],
        cropbox_in_pdf: Tuple[int, int],
    ) -> List[Annotation]:
        return self._get_annotation(
            tokens=self.matched_chemicals,
            token_type=EntityType.Chemical.value,
            color=EntityColor.Chemical.value,
            transaction=self.lmdb_session.chemicals_txn,
            id_str=entity_id_str,
            correct_spellings=self.correct_spellings,
            char_coord_objs_in_pdf=char_coord_objs_in_pdf,
            cropbox_in_pdf=cropbox_in_pdf,
        )

    def _annotate_compounds(
        self,
        entity_id_str: str,
        char_coord_objs_in_pdf: List[Union[LTChar, LTAnno]],
        cropbox_in_pdf: Tuple[int, int],
    ) -> List[Annotation]:
        return self._get_annotation(
            tokens=self.matched_compounds,
            token_type=EntityType.Compound.value,
            color=EntityColor.Compound.value,
            transaction=self.lmdb_session.compounds_txn,
            id_str=entity_id_str,
            correct_spellings=self.correct_spellings,
            char_coord_objs_in_pdf=char_coord_objs_in_pdf,
            cropbox_in_pdf=cropbox_in_pdf,
        )

    def _annotate_proteins(
        self,
        entity_id_str: str,
        char_coord_objs_in_pdf: List[Union[LTChar, LTAnno]],
        cropbox_in_pdf: Tuple[int, int],
    ) -> List[Annotation]:
        return self._get_annotation(
            tokens=self.matched_proteins,
            token_type=EntityType.Protein.value,
            color=EntityColor.Protein.value,
            transaction=self.lmdb_session.proteins_txn,
            id_str=entity_id_str,
            correct_spellings=self.correct_spellings,
            char_coord_objs_in_pdf=char_coord_objs_in_pdf,
            cropbox_in_pdf=cropbox_in_pdf,
        )

    def _annotate_custom_species(
        self,
        entity_id_str: str,
        char_coord_objs_in_pdf: List[Union[LTChar, LTAnno]],
        cropbox_in_pdf: Tuple[int, int],
    ) -> List[Annotation]:
        tokens = self.matched_custom_species

        custom_annotations: List[Annotation] = []

        for word, token_list in tokens.items():
            for token_positions in token_list:
                # only care about entity id type for these custom
                # species annotations
                # as won't be keeping them as they're only used
                # to help with gene organism matching
                entity = {'synonym': word, 'id_type': DatabaseType.Ncbi.value}
                annotation = self._create_annotation_object(
                    char_coord_objs_in_pdf=char_coord_objs_in_pdf,
                    cropbox_in_pdf=cropbox_in_pdf,
                    token_positions=token_positions,
                    token_type=EntityType.Species.value,
                    entity=entity,
                    entity_id=self.custom_species[word],
                    entity_category=entity.get('category', None),
                    color=EntityColor.Species.value,
                    correct_spellings=self.correct_spellings,
                )

                custom_annotations.append(annotation)
        return custom_annotations

    def _annotate_species(
        self,
        entity_id_str: str,
        char_coord_objs_in_pdf: List[Union[LTChar, LTAnno]],
        cropbox_in_pdf: Tuple[int, int],
        organisms_from_custom_annotations: List[dict],
    ) -> List[Annotation]:
        species_annotations = self._get_annotation(
            tokens=self.matched_species,
            token_type=EntityType.Species.value,
            color=EntityColor.Species.value,
            transaction=self.lmdb_session.species_txn,
            id_str=entity_id_str,
            correct_spellings=self.correct_spellings,
            char_coord_objs_in_pdf=char_coord_objs_in_pdf,
            cropbox_in_pdf=cropbox_in_pdf,
        )

        custom_species_annotations = self._annotate_custom_species(
            entity_id_str=entity_id_str,
            char_coord_objs_in_pdf=char_coord_objs_in_pdf,
            cropbox_in_pdf=cropbox_in_pdf,
        )

        def has_center_point(
            custom_rect_coords: List[float],
            rect_coords: List[float],
        ) -> bool:
            x1 = rect_coords[0]
            y1 = rect_coords[1]
            x2 = rect_coords[2]
            y2 = rect_coords[3]

            center_x = (x1 + x2)/2
            center_y = (y1 + y2)/2

            rect_x1 = custom_rect_coords[0]
            rect_y1 = custom_rect_coords[1]
            rect_x2 = custom_rect_coords[2]
            rect_y2 = custom_rect_coords[3]

            return rect_x1 <= center_x <= rect_x2 and rect_y1 <= center_y <= rect_y2

        # we only want the annotations with correct coordinates
        # because it is possible for a word to only have one
        # of its occurrences annotated as a custom annotation
        filtered_custom_species_annotations: List[Annotation] = []
        for custom in organisms_from_custom_annotations:
            for custom_anno in custom_species_annotations:
                if len(custom['rects']) == len(custom_anno.rects):
                    # check if center point for each rect in custom_anno.rects
                    # is in the corresponding rectangle from custom annotations
                    valid = all(list(map(has_center_point, custom['rects'], custom_anno.rects)))

                    # if center point is in custom annotation rectangle
                    # then add it to list
                    if valid:
                        filtered_custom_species_annotations.append(custom_anno)

        self.organism_frequency, self.organism_locations, self.organism_categories = \
            self._get_entity_frequency_location_and_category(
                annotations=species_annotations + filtered_custom_species_annotations,
            )

        # don't return the custom annotations because they should stay as custom
        return species_annotations

    def _annotate_diseases(
        self,
        entity_id_str: str,
        char_coord_objs_in_pdf: List[Union[LTChar, LTAnno]],
        cropbox_in_pdf: Tuple[int, int],
    ) -> List[Annotation]:
        return self._get_annotation(
            tokens=self.matched_diseases,
            token_type=EntityType.Disease.value,
            color=EntityColor.Disease.value,
            transaction=self.lmdb_session.diseases_txn,
            id_str=entity_id_str,
            correct_spellings=self.correct_spellings,
            char_coord_objs_in_pdf=char_coord_objs_in_pdf,
            cropbox_in_pdf=cropbox_in_pdf,
        )

    def _annotate_phenotypes(
        self,
        entity_id_str: str,
        char_coord_objs_in_pdf: List[Union[LTChar, LTAnno]],
        cropbox_in_pdf: Tuple[int, int],
    ) -> List[Annotation]:
        return self._get_annotation(
            tokens=self.matched_phenotypes,
            token_type=EntityType.Phenotype.value,
            color=EntityColor.Phenotype.value,
            transaction=self.lmdb_session.phenotypes_txn,
            id_str=entity_id_str,
            correct_spellings=self.correct_spellings,
            char_coord_objs_in_pdf=char_coord_objs_in_pdf,
            cropbox_in_pdf=cropbox_in_pdf,
        )

    def annotate(
        self,
        annotation_type: str,
        entity_id_str: str,
        char_coord_objs_in_pdf: List[Union[LTChar, LTAnno]],
        cropbox_in_pdf: Tuple[int, int],
        organisms_from_custom_annotations: List[dict],
    ) -> List[Annotation]:
        funcs = {
            EntityType.Chemical.value: self._annotate_chemicals,
            EntityType.Compound.value: self._annotate_compounds,
            EntityType.Protein.value: self._annotate_proteins,
            EntityType.Species.value: self._annotate_species,
            EntityType.Disease.value: self._annotate_diseases,
            EntityType.Phenotype.value: self._annotate_phenotypes,
            EntityType.Gene.value: self._annotate_genes,
        }

        annotate_entities = funcs[annotation_type]
        if annotation_type == EntityType.Gene.value:
            return annotate_entities(
                entity_id_str=entity_id_str,
                char_coord_objs_in_pdf=char_coord_objs_in_pdf,
                cropbox_in_pdf=cropbox_in_pdf,
                organisms_from_custom_annotations={
                    organism['meta']['id'] for organism in organisms_from_custom_annotations},
            )  # type: ignore
        elif annotation_type == EntityType.Species.value:
            return annotate_entities(
                entity_id_str=entity_id_str,
                char_coord_objs_in_pdf=char_coord_objs_in_pdf,
                cropbox_in_pdf=cropbox_in_pdf,
                organisms_from_custom_annotations=organisms_from_custom_annotations,
            )  # type: ignore
        else:
            return annotate_entities(
                entity_id_str=entity_id_str,
                char_coord_objs_in_pdf=char_coord_objs_in_pdf,
                cropbox_in_pdf=cropbox_in_pdf,
            )  # type: ignore

    def _update_entity_frequency_map(
        self,
        entity_frequency: Dict[str, int],
        annotation: Annotation,
    ) -> Dict[str, int]:
        entity_id = annotation.meta.id
        if entity_frequency.get(entity_id, None) is not None:
            entity_frequency[entity_id] += 1
        else:
            entity_frequency[entity_id] = 1

        # If this annotation is a virus then we also have to update the homo sapiens frequency
        if isinstance(annotation.meta, OrganismAnnotation.OrganismMeta) and annotation.meta.category == OrganismCategory.Viruses.value:  # noqa
            if entity_frequency.get(HOMO_SAPIENS_TAX_ID, None) is not None:
                entity_frequency[HOMO_SAPIENS_TAX_ID] += 1
            else:
                entity_frequency[HOMO_SAPIENS_TAX_ID] = 1

        return entity_frequency

    def _update_entity_location_map(
        self,
        matched_entity_locations: Dict[str, List[Tuple[int, int]]],
        annotation: Annotation,
    ) -> Dict[str, List[Tuple[int, int]]]:
        if matched_entity_locations.get(annotation.meta.id, None) is not None:
            matched_entity_locations[annotation.meta.id].append(
                (annotation.lo_location_offset, annotation.hi_location_offset)
            )
        else:
            matched_entity_locations[annotation.meta.id] = [
                (annotation.lo_location_offset, annotation.hi_location_offset)
            ]

        # If the annotation represents a virus, then also mark this location as a human
        # annotation
        if isinstance(annotation.meta, OrganismAnnotation.OrganismMeta) and annotation.meta.category == OrganismCategory.Viruses.value:  # noqa
            if matched_entity_locations.get(HOMO_SAPIENS_TAX_ID, None) is not None:  # noqa
                matched_entity_locations[HOMO_SAPIENS_TAX_ID].append(  # noqa
                    (annotation.lo_location_offset, annotation.hi_location_offset)
                )
            else:
                matched_entity_locations[HOMO_SAPIENS_TAX_ID] = [
                    (annotation.lo_location_offset, annotation.hi_location_offset)
                ]

        return matched_entity_locations

    def _get_entity_frequency_location_and_category(
        self,
        annotations: List[Annotation],
    ) -> Tuple[
            Dict[str, int],
            Dict[str, List[Tuple[int, int]]],
            Dict[str, str]]:
        """Takes as input a list of annotation objects (intended to be of a single entity type).

        Returns the frequency of the annotation entities, and their locations within the document.
        """
        matched_entity_locations: Dict[str, List[Tuple[int, int]]] = {}
        entity_frequency: Dict[str, int] = {}
        entity_categories: Dict[str, str] = {}

        for annotation in annotations:
            entity_frequency = self._update_entity_frequency_map(
                entity_frequency=entity_frequency,
                annotation=annotation,
            )
            matched_entity_locations = self._update_entity_location_map(
                matched_entity_locations=matched_entity_locations,
                annotation=annotation,
            )
            entity_categories[annotation.meta.id] = annotation.meta.to_dict().get('category', '')

            # Need to add an entry for humans if we annotated a virus
            if isinstance(annotation, OrganismAnnotation) and isinstance(annotation.meta, OrganismAnnotation.OrganismMeta):  # noqa
                if annotation.meta.category == OrganismCategory.Viruses.value:  # noqa
                    entity_categories[HOMO_SAPIENS_TAX_ID] = OrganismCategory.Eukaryota.value

        return entity_frequency, matched_entity_locations, entity_categories

    def _get_fixed_false_positive_unified_annotations(
        self,
        annotations_list: List[Annotation],
    ) -> List[Annotation]:
        """Removes any false positive annotations.

        False positives occurred during our matching
        because we normalize the text from the pdf and
        the keys in lmdb.

        False positives are multi length word that
        got matched to a shorter length word due to
        normalizing in lmdb.

        Gene related false positives are bacterial
        genes in the form of cysB, algA, deaD, etc.
        """
        fixed_annotations: List[Annotation] = []

        for annotation in annotations_list:
            text_in_document = annotation.text_in_document.split(' ')

            # TODO: Does the order of these checks matter?

            if len(text_in_document) > 1:
                keyword_from_annotation = annotation.keyword.split(' ')
                if len(keyword_from_annotation) >= len(text_in_document):
                    fixed_annotations.append(annotation)
                else:
                    # consider case such as `ferredoxin 2` vs `ferredoxin-2` in lmdb
                    keyword_from_annotation = annotation.keyword.split('-')
                    if len(keyword_from_annotation) >= len(text_in_document):
                        fixed_annotations.append(annotation)
            elif isinstance(annotation, GeneAnnotation):
                text_in_document = text_in_document[0]  # type: ignore
                # if the matched keyword from LMDB is all caps
                # check if the text from document is also all caps
                # e.g `impact` matching to `IMPACT`
                if annotation.keyword.isupper():
                    if text_in_document == annotation.keyword:
                        fixed_annotations.append(annotation)
                # len(text_in_document) == LOWERCASE_FIRST_LETTER_UPPERCASE_LAST_LETTER_GENE_LENGTH
                # does this only apply to genes with specific length?
                elif isinstance(annotation.meta, GeneAnnotation.GeneMeta) and \
                        annotation.meta.category == OrganismCategory.Bacteria.value:
                    # bacteria genes are in the from of cysB, algA, deaD, etc
                    # there are also bacterial genes that do not end
                    # with an uppercase, e.g apt - these will not be annotated
                    if text_in_document[0].islower() and text_in_document[-1].isupper():  # noqa
                        fixed_annotations.append(annotation)
                else:
                    fixed_annotations.append(annotation)
            else:
                fixed_annotations.append(annotation)

        return fixed_annotations

    def _create_annotations(
        self,
        tokens: List[PDFTokenPositions],
        char_coord_objs_in_pdf: List[Union[LTChar, LTAnno]],
        cropbox_in_pdf: Tuple[int, int],
        check_entities_in_lmdb: Dict[str, bool],
        types_to_annotate: List[Tuple[str, str]],
        organisms_from_custom_annotations: List[dict],
    ) -> List[Annotation]:
        """Create annotations.

        Args:
            tokens: list of PDFTokenPositions
            char_coord_objs_in_pdf: list of char objects from pdfminer
            cropbox_in_pdf: the mediabox/cropbox offset from pdfminer
            check_entities_in_lmdb: a dictionary of entity types and boolean
                - boolean determines whether to check lmdb for that entity
            types_to_annotate: list of entity types to create annotations of
                - NOTE: IMPORTANT: should always match with `check_entities_in_lmdb`
                - NOTE: IMPORTANT: Species should always be before Genes
                    - because species is used to do gene organism matching
                - e.g [
                    (EntityType.Species.value, EntityIdStr.Species.value),
                    (EntityType.Chemical.value, EntityIdStr.Chemical.value),
                    ...
                ]
        """
        # find matches in lmdb
        from functools import partial
        deque(map(partial(self._find_lmdb_match, check_entities=check_entities_in_lmdb), tokens), maxlen=0)  # noqa

        unified_annotations: List[Annotation] = []

        for entity_type, entity_id_str in types_to_annotate:
            annotations = self.annotate(
                annotation_type=entity_type,
                entity_id_str=entity_id_str,
                char_coord_objs_in_pdf=char_coord_objs_in_pdf,
                cropbox_in_pdf=cropbox_in_pdf,
                organisms_from_custom_annotations=organisms_from_custom_annotations,
            )
            unified_annotations.extend(annotations)

        return unified_annotations

    def create_rules_based_annotations(
        self,
        tokens: PDFTokenPositionsList,
        custom_annotations: List[dict],
    ) -> List[Annotation]:
        entity_type_and_id_pairs = [
            # Order is IMPORTANT here, Species should always be annotated before Genes
            (EntityType.Species.value, EntityIdStr.Species.value),
            (EntityType.Chemical.value, EntityIdStr.Chemical.value),
            (EntityType.Compound.value, EntityIdStr.Compound.value),
            (EntityType.Protein.value, EntityIdStr.Protein.value),
            (EntityType.Disease.value, EntityIdStr.Disease.value),
            (EntityType.Phenotype.value, EntityIdStr.Phenotype.value),
            (EntityType.Gene.value, EntityIdStr.Gene.value),
        ]

        # TODO: hard coding for now until UI is done
        entities_to_check = {
            EntityType.Chemical.value: True,
            EntityType.Compound.value: True,
            EntityType.Disease.value: True,
            EntityType.Gene.value: True,
            EntityType.Phenotype.value: True,
            EntityType.Protein.value: True,
            EntityType.Species.value: True,
        }

        self.custom_species = {
            custom['meta']['allText']: custom['meta']['id'] for custom in custom_annotations
            if custom['meta']['type'] == EntityType.Species.value
        }

        annotations = self._create_annotations(
            tokens=tokens.token_positions,
            char_coord_objs_in_pdf=tokens.char_coord_objs_in_pdf,
            cropbox_in_pdf=tokens.cropbox_in_pdf,
            check_entities_in_lmdb=entities_to_check,
            types_to_annotate=entity_type_and_id_pairs,
            organisms_from_custom_annotations=custom_annotations,
        )
        return self._clean_annotations(annotations=annotations)

    def create_nlp_annotations(
        self,
        page_index: Dict[int, int],
        text: str,
        tokens: PDFTokenPositionsList,
        custom_annotations: List[dict]
    ) -> List[Annotation]:
        cumm_nlp_resp = []
        nlp_tokens: List[PDFTokenPositions] = []
        req = None
        pages_to_index = {v: k for k, v in page_index.items()}
        pages = list(pages_to_index)
        text_in_page: List[Tuple[int, str]] = []

        # TODO: Breaking the request into pages
        # because doing the entire PDF seem to cause
        # the NLP service container to crash with no
        # errors and exit code of 247... (memory related)
        length = len(pages) - 1
        for i, page in enumerate(pages):
            if i == length:
                text_in_page.append((page, text[pages_to_index[page]:]))
            else:
                text_in_page.append((page, text[pages_to_index[page]:pages_to_index[page+1]]))

        for page, page_text in text_in_page:
            try:
                req = requests.post(NLP_ENDPOINT, json={'text': page_text}, timeout=30)
                nlp_resp = req.json()

                for predicted in nlp_resp:
                    # TODO: nlp only checks for Bacteria right now
                    # replace with Species in the future
                    if predicted['type'] != 'Bacteria':
                        # need to do offset here because index resets
                        # after each text string for page
                        offset = pages_to_index[page]
                        curr_char_idx_mappings = {
                            i+offset: char for i, char in zip(
                                range(predicted['low_index'], predicted['high_index']),
                                predicted['item'],
                            )
                        }

                        # determine page keyword is on
                        page_idx = -1
                        min_page_idx_list = list(tokens.min_idx_in_page)
                        for min_page_idx in min_page_idx_list:
                            # include offset here, see above
                            if predicted['high_index']+offset <= min_page_idx:
                                # reminder: can break here because dict in python 3.8+ are
                                # insertion order
                                break
                            else:
                                page_idx = min_page_idx
                        token = PDFTokenPositions(
                            page_number=tokens.min_idx_in_page[page_idx],
                            keyword=predicted['item'],
                            char_positions=curr_char_idx_mappings,
                            token_type=predicted['type'],
                        )
                        nlp_tokens.append(token)

                        offset_predicted = {k: v for k, v in predicted.items()}
                        offset_predicted['high_index'] += offset
                        offset_predicted['low_index'] += offset

                        cumm_nlp_resp.append(offset_predicted)
            except requests.exceptions.RequestException:
                raise AnnotationError('An error occurred with the NLP service.')

        print(f'NLP Response Output: {json.dumps(cumm_nlp_resp)}')

        if req:
            req.close()

        # match species using rules based approach
        # TODO: possibly until nlp gets better at identifying species
        entity_type_and_id_pairs = [
            (EntityType.Species.value, EntityIdStr.Species.value),
        ]

        # TODO: hard coding for now until UI is done
        entities_to_check = {
            EntityType.Chemical.value: False,
            EntityType.Compound.value: False,
            EntityType.Disease.value: False,
            EntityType.Gene.value: False,
            EntityType.Phenotype.value: False,
            EntityType.Protein.value: False,
            EntityType.Species.value: True,
        }

        self.custom_species = {
            custom['meta']['allText']: custom['meta']['id'] for custom in custom_annotations
            if custom['meta']['type'] == EntityType.Species.value
        }

        species_annotations = self._create_annotations(
            tokens=tokens.token_positions,
            char_coord_objs_in_pdf=tokens.char_coord_objs_in_pdf,
            cropbox_in_pdf=tokens.cropbox_in_pdf,
            check_entities_in_lmdb=entities_to_check,
            types_to_annotate=entity_type_and_id_pairs,
            organisms_from_custom_annotations=custom_annotations,
        )

        # now annotate what nlp found
        entity_type_and_id_pairs = [
            (EntityType.Chemical.value, EntityIdStr.Chemical.value),
            (EntityType.Compound.value, EntityIdStr.Compound.value),
            (EntityType.Protein.value, EntityIdStr.Protein.value),
            (EntityType.Disease.value, EntityIdStr.Disease.value),
            (EntityType.Phenotype.value, EntityIdStr.Phenotype.value),
            (EntityType.Gene.value, EntityIdStr.Gene.value),
        ]

        # TODO: hard coding for now until UI is done
        entities_to_check = {
            EntityType.Chemical.value: True,
            EntityType.Compound.value: True,
            EntityType.Disease.value: True,
            EntityType.Gene.value: True,
            EntityType.Phenotype.value: True,
            EntityType.Protein.value: True,
            EntityType.Species.value: False,
        }

        nlp_annotations = self._create_annotations(
            tokens=nlp_tokens,
            char_coord_objs_in_pdf=tokens.char_coord_objs_in_pdf,
            cropbox_in_pdf=tokens.cropbox_in_pdf,
            check_entities_in_lmdb=entities_to_check,
            types_to_annotate=entity_type_and_id_pairs,
            organisms_from_custom_annotations=custom_annotations,
        )

        unified_annotations = species_annotations + nlp_annotations

        # TODO: TEMP to keep track of things not matched in LMDB
        matched: Set[str] = set()
        predicted_set: Set[str] = set()
        for predicted in cumm_nlp_resp:
            predicted_str = predicted['item']
            predicted_type = predicted['type']
            predicted_hashstr = f'{predicted_str},{predicted_type}'
            predicted_set.add(predicted_hashstr)

        for anno in unified_annotations:
            # TODO: temp for now as NLP only use Bacteria
            if anno.meta.type == 'Species':
                keyword_type = 'Bacteria'
            else:
                keyword_type = anno.meta.type
            hashstr = f'{anno.text_in_document},{keyword_type}'
            matched.add(hashstr)

        not_matched = predicted_set - matched

        print(f'NLP TOKENS NOT MATCHED TO LMDB {not_matched}')
        return self._clean_annotations(annotations=unified_annotations)

    def _clean_annotations(
        self,
        annotations: List[Annotation],
    ) -> List[Annotation]:
        fixed_unified_annotations = self._get_fixed_false_positive_unified_annotations(
            annotations_list=annotations,
        )

        fixed_unified_annotations = self.fix_conflicting_annotations(
            unified_annotations=fixed_unified_annotations,
        )
        return fixed_unified_annotations

    def fix_conflicting_annotations(
        self,
        unified_annotations: List[Annotation],
    ) -> List[Annotation]:
        """Annotations and keywords may span multiple entity types
        (e.g. compounds, chemicals, organisms, etc.), resulting in conflicting
        annotations.

        An annotation is a conflict if:
        - it has overlapping `lo_location_offset` and `hi_location_offset` with
            another annotation.
        - it has adjacent intervals, meaning a `hi_location_offset` equals
            the `lo_location_offset` of another annotation.
        """
        updated_unified_annotations: List[Annotation] = []
        annotations_to_clean: List[Annotation] = []

        for unified in unified_annotations:
            if unified.lo_location_offset == unified.hi_location_offset:
                # keyword is a single character
                # should not have overlaps
                updated_unified_annotations.append(unified)
            else:
                annotations_to_clean.append(unified)

        tree = self.create_annotation_tree(annotations=annotations_to_clean)
        # first clean all annotations with equal intervals
        # this means the same keyword was mapped to multiple entities
        cleaned_of_equal_intervals = tree.merge_equals(
            data_reducer=self.determine_entity_precedence,
        )

        fixed_annotations = self._remove_overlapping_annotations(
            conflicting_annotations=cleaned_of_equal_intervals,
        )

        updated_unified_annotations.extend(fixed_annotations)
        return updated_unified_annotations

    def create_annotation_tree(
        self,
        annotations: List[Annotation],
    ) -> AnnotationIntervalTree:
        tree = AnnotationIntervalTree()
        for annotation in annotations:
            tree.add(
                AnnotationInterval(
                    begin=annotation.lo_location_offset,
                    end=annotation.hi_location_offset,
                    data=annotation,
                ),
            )
        return tree

    def determine_entity_precedence(
        self,
        anno1: Annotation,
        anno2: Annotation,
    ) -> Annotation:
        key1 = ENTITY_TYPE_PRECEDENCE[anno1.meta.type]
        key2 = ENTITY_TYPE_PRECEDENCE[anno2.meta.type]

        # only do special gene vs protein comparison if they have
        # exact intervals
        # because that means the same normalized text was matched
        # to both
        if ((anno1.meta.type == EntityType.Protein.value or
                anno1.meta.type == EntityType.Gene.value) and
            (anno2.meta.type == EntityType.Protein.value or
                anno2.meta.type == EntityType.Gene.value) and
            (anno1.lo_location_offset == anno2.lo_location_offset and
                anno1.hi_location_offset == anno2.hi_location_offset)):  # noqa
            if anno1.meta.type != anno2.meta.type:
                # protein vs gene
                # protein has capital first letter: CysB
                # gene has lowercase: cysB
                # also cases like gene SerpinA1 vs protein Serpin A1

                def check_gene_protein(
                    anno1: Annotation,
                    anno2: Annotation,
                    anno1_text_in_document: str,
                    anno2_text_in_document: str,
                ):
                    """First check for exact match
                    if no exact match then check substrings
                    e.g `Serpin A1` matched to `serpin A1`
                    e.g `SerpinA1` matched to `serpin A1`

                    We take the first case will not count hyphens separated
                    because hard to infer if it was used as a space
                    need to consider precedence in case gene and protein
                    have the exact spelling correct annotated word
                    """
                    if anno1_text_in_document == anno1.keyword:
                        return anno1
                    if anno2_text_in_document == anno2.keyword:
                        return anno2

                    if len(anno1_text_in_document.split(' ')) == len(anno1.keyword.split(' ')):
                        return anno1
                    if len(anno2_text_in_document.split(' ')) == len(anno2.keyword.split(' ')):
                        return anno2

                    return None

                if key1 > key2:
                    gene_protein_precedence_result = check_gene_protein(
                        anno1=anno1,
                        anno2=anno2,
                        anno1_text_in_document=anno1.text_in_document,
                        anno2_text_in_document=anno2.text_in_document,
                    )
                else:
                    gene_protein_precedence_result = check_gene_protein(
                        anno1=anno2,
                        anno2=anno1,
                        anno1_text_in_document=anno2.text_in_document,
                        anno2_text_in_document=anno1.text_in_document,
                    )

                if gene_protein_precedence_result is not None:
                    return gene_protein_precedence_result

        if key1 > key2:
            return anno1
        elif key2 > key1:
            return anno2
        else:
            if anno1.keyword_length > anno2.keyword_length:
                return anno1
            else:
                return anno2

    def _remove_overlapping_annotations(
        self,
        conflicting_annotations: List[Annotation],
    ) -> List[Annotation]:
        """Remove annotations based on rules defined in
        self.determine_entity_precedence().
        """
        fixed_annotations: List[Annotation] = []

        if conflicting_annotations:
            tree = self.create_annotation_tree(annotations=conflicting_annotations)
            fixed_annotations.extend(
                tree.merge_overlaps(
                    data_reducer=self.determine_entity_precedence,
                ),
            )
        return fixed_annotations

    def get_matching_manual_annotations(
        self,
        keyword: str,
        tokens: PDFTokenPositionsList
    ):
        """Returns coordinate positions and page numbers
        for all matching terms in the document
        """
        matches = []
        for token in tokens.token_positions:
            if token.keyword != keyword:
                continue
            keyword_positions: List[Annotation.TextPosition] = []
            self._create_keyword_objects(
                curr_page_coor_obj=tokens.char_coord_objs_in_pdf,
                indexes=list(token.char_positions.keys()),
                keyword_positions=keyword_positions,
                cropbox=tokens.cropbox_in_pdf,
            )
            rects = [pos.positions for pos in keyword_positions]
            keywords = [pos.value for pos in keyword_positions]
            matches.append({
                'pageNumber': token.page_number,
                'rects': rects,
                'keywords': keywords
            })
        return matches
