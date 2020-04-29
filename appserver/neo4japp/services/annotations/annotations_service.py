import json
import re

from string import ascii_lowercase, digits, punctuation
from typing import Dict, List, Optional, Set, Tuple, Union

from pdfminer.layout import LTAnno, LTChar

from .annotation_interval_tree import (
    AnnotationInterval,
    AnnotationIntervalTree,
)
from .constants import (
    COMMON_WORDS,
    TYPO_SYNONYMS,
    EntityColor,
    EntityIdStr,
    EntityType,
    ENTITY_TYPE_PRECEDENCE,
    PDF_NEW_LINE_THRESHOLD,
    NCBI_LINK,
    UNIPROT_LINK,
    WIKIPEDIA_LINK,
    GOOGLE_LINK,
)
from .lmdb_dao import LMDBDao
from .util import normalize_str

from neo4japp.data_transfer_objects import (
    Annotation,
    PDFTokenPositions,
    PDFTokenPositionsList,
)
from neo4japp.util import compute_hash


class AnnotationsService:
    def __init__(
        self,
        lmdb_session: LMDBDao,
    ) -> None:
        self.regex_for_floats = r'^-?\d+(?:\.\d+)?$'

        self.lmdb_session = lmdb_session

        # for word tokens that are typos
        self.correct_synonyms: Dict[str, str] = {}

        self.matched_genes: Dict[str, List[PDFTokenPositions]] = {}
        self.matched_chemicals: Dict[str, List[PDFTokenPositions]] = {}
        self.matched_compounds: Dict[str, List[PDFTokenPositions]] = {}
        self.matched_proteins: Dict[str, List[PDFTokenPositions]] = {}
        self.matched_species: Dict[str, List[PDFTokenPositions]] = {}
        self.matched_diseases: Dict[str, List[PDFTokenPositions]] = {}

        self.validated_genes_tokens: Set[str] = set()
        self.validated_chemicals_tokens: Set[str] = set()
        self.validated_compounds_tokens: Set[str] = set()
        self.validated_proteins_tokens: Set[str] = set()
        self.validated_species_tokens: Set[str] = set()
        self.validated_diseases_tokens: Set[str] = set()

    def lmdb_validation(
        self,
        word: str,
        token: PDFTokenPositions,
        synonym: Optional[str] = None,
    ):
        """Validate the lookup key exists in LMDB. If it
        does, then add it as a match.

        Args:
            word: the token text
            synonym: the correct spelling (if word is misspelled) or normalized token
        """
        if synonym:
            lookup_key = normalize_str(synonym).encode('utf-8')
        else:
            lookup_key = word.encode('utf-8')
        hashval = compute_hash(token.to_dict())

        gene_val = self.lmdb_session.genes_txn.get(lookup_key)
        if gene_val and hashval not in self.validated_genes_tokens:
            self.validated_genes_tokens.add(hashval)
            if word in self.matched_genes:
                self.matched_genes[word].append(token)
            else:
                self.matched_genes[word] = [token]

        chem_val = self.lmdb_session.chemicals_txn.get(lookup_key)
        if chem_val and hashval not in self.validated_chemicals_tokens:
            self.validated_chemicals_tokens.add(hashval)
            if word in self.matched_chemicals:
                self.matched_chemicals[word].append(token)
            else:
                self.matched_chemicals[word] = [token]

        comp_val = self.lmdb_session.compounds_txn.get(lookup_key)
        if comp_val and hashval not in self.validated_compounds_tokens:
            self.validated_compounds_tokens.add(hashval)
            if word in self.matched_compounds:
                self.matched_compounds[word].append(token)
            else:
                self.matched_compounds[word] = [token]

        protein_val = self.lmdb_session.proteins_txn.get(lookup_key)
        if protein_val and hashval not in self.validated_proteins_tokens:
            self.validated_proteins_tokens.add(hashval)
            if word in self.matched_proteins:
                self.matched_proteins[word].append(token)
            else:
                self.matched_proteins[word] = [token]

        species_val = self.lmdb_session.species_txn.get(lookup_key)
        if species_val and hashval not in self.validated_species_tokens:
            self.validated_species_tokens.add(hashval)
            if word in self.matched_species:
                self.matched_species[word].append(token)
            else:
                self.matched_species[word] = [token]

        diseases_val = self.lmdb_session.diseases_txn.get(lookup_key)
        if diseases_val and hashval not in self.validated_diseases_tokens:
            self.validated_diseases_tokens.add(hashval)
            if word in self.matched_diseases:
                self.matched_diseases[word].append(token)
            else:
                self.matched_diseases[word] = [token]

        return [
            gene_val, chem_val, comp_val,
            protein_val, species_val, diseases_val,
        ]

    def _filter_tokens(self, tokens: PDFTokenPositionsList) -> None:
        """Filter the tokens into separate matched sets in LMDB."""
        for token in tokens.token_positions:
            token_normalized = normalize_str(token.keyword)

            if token_normalized:
                if (token_normalized not in COMMON_WORDS and
                        not re.match(self.regex_for_floats, token_normalized) and
                        token_normalized not in ascii_lowercase and
                        token_normalized not in digits):

                    if token_normalized in TYPO_SYNONYMS:
                        for correct_synonym in TYPO_SYNONYMS[token_normalized]:
                            validations = self.lmdb_validation(
                                word=token_normalized,
                                token=token,
                                synonym=correct_synonym,
                            )

                            # just get the first match is fine
                            if any(validations):
                                self.correct_synonyms[token_normalized] = correct_synonym
                                break
                    else:
                        self.lmdb_validation(
                            word=token_normalized,
                            token=token,
                        )

    def _create_keyword_objects(
        self,
        curr_page_coor_obj: List[Union[LTChar, LTAnno]],
        indexes: List[int],
        cropbox: Tuple[int, int],
        keyword_positions: List[Annotation.TextPosition] = [],
    ) -> Tuple[float, float, float, float]:
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
            while isinstance(curr_page_coor_obj[i], LTAnno) and i >= 0:
                i -= 1
            return i

        start_lower_x = None
        start_lower_y = None
        end_upper_x = None
        end_upper_y = None

        keyword = ''
        for i, pos_idx in enumerate(indexes):
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
                else:
                    if upper_y > end_upper_y:
                        end_upper_y = upper_y

                    if upper_x > end_upper_x:
                        end_upper_x = upper_x

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
                        _, _, new_upper_x, new_upper_y = self._create_keyword_objects(
                            curr_page_coor_obj=curr_page_coor_obj,
                            indexes=indexes[i:],
                            keyword_positions=keyword_positions,
                            cropbox=cropbox,
                        )

                        if new_upper_x > end_upper_x:
                            end_upper_x = new_upper_x

                        if new_upper_y > end_upper_y:
                            end_upper_y = new_upper_y
                        break
                    else:
                        keyword += curr_page_coor_obj[pos_idx].get_text()
                else:
                    keyword += curr_page_coor_obj[pos_idx].get_text()

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
        return start_lower_x, start_lower_y, end_upper_x, end_upper_y

    def _get_annotation(
        self,
        tokens: Dict[str, List[PDFTokenPositions]],
        token_type: str,
        color: str,
        transaction,
        id_str: str,
        correct_synonyms: Dict[str, str],
        coor_obj_per_pdf_page: Dict[int, List[Union[LTChar, LTAnno]]],
        cropbox_per_page: Dict[int, Tuple[int, int]],
    ) -> Tuple[List[Annotation], Set[str]]:
        """Create annotation objects for tokens.

        Assumption:
            - An entity in LMDB will always have a common name
                (1) this means a common name will have itself as a common name
                (2) synonyms will have at least one common name

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
        """
        matches: List[Annotation] = []
        unwanted_matches: Set[str] = set()

        tokens_lowercased = set(tokens.keys())

        for word, token_positions_list in tokens.items():
            for token_positions in token_positions_list:
                if word in correct_synonyms:
                    lookup_key = correct_synonyms[word]
                else:
                    lookup_key = word

                lookup_key = normalize_str(lookup_key)
                entity = json.loads(transaction.get(lookup_key.encode('utf-8')))

                common_name_count = 0
                if len(entity['common_name']) > 1:
                    common_names = set([v for _, v in entity['common_name'].items()])
                    common_names_in_doc_text = [n in tokens_lowercased for n in common_names]  # noqa

                    # skip if none of the common names appear
                    if not any(common_names_in_doc_text):
                        continue
                    else:
                        for k, v in entity['common_name'].items():
                            if v in tokens_lowercased:
                                common_name_count += 1
                                entity_id = k
                else:
                    common_name_count = 1
                    entity_id = entity[id_str]

                if common_name_count == 1:
                    # create list of positions boxes
                    curr_page_coor_obj = coor_obj_per_pdf_page[
                        token_positions.page_number]
                    cropbox = cropbox_per_page[token_positions.page_number]

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
                    link_search_term = f'{token_positions.keyword}'

                    meta = Annotation.Meta(
                        keyword_type=token_type,
                        color=color,
                        id=entity_id,
                        id_type=entity['id_type'],
                        links=Annotation.Meta.Links(
                            ncbi=NCBI_LINK + link_search_term,
                            uniprot=UNIPROT_LINK + link_search_term,
                            wikipedia=WIKIPEDIA_LINK + link_search_term,
                            google=GOOGLE_LINK + link_search_term,
                        ),
                    )

                    matches.append(
                        Annotation(
                            page_number=token_positions.page_number,
                            rects=[pos.positions for pos in keyword_positions],  # type: ignore
                            keywords=[k.value for k in keyword_positions],
                            keyword=token_positions.keyword,
                            keyword_length=len(token_positions.keyword),
                            lo_location_offset=keyword_starting_idx,
                            hi_location_offset=keyword_ending_idx,
                            meta=meta,
                        )
                    )
                else:
                    unwanted_matches.add(word)
        return matches, unwanted_matches

    def _annotate_genes(
        self,
        entity_id_str: str,
        coor_obj_per_pdf_page: Dict[int, List[Union[LTChar, LTAnno]]],
        cropbox_per_page: Dict[int, Tuple[int, int]],
    ) -> Tuple[List[Annotation], Set[str]]:
        return self._get_annotation(
            tokens=self.matched_genes,
            token_type=EntityType.Genes.value,
            color=EntityColor.Genes.value,
            transaction=self.lmdb_session.genes_txn,
            id_str=entity_id_str,
            correct_synonyms=self.correct_synonyms,
            coor_obj_per_pdf_page=coor_obj_per_pdf_page,
            cropbox_per_page=cropbox_per_page,
        )

    def _annotate_chemicals(
        self,
        entity_id_str: str,
        coor_obj_per_pdf_page: Dict[int, List[Union[LTChar, LTAnno]]],
        cropbox_per_page: Dict[int, Tuple[int, int]],
    ) -> Tuple[List[Annotation], Set[str]]:
        return self._get_annotation(
            tokens=self.matched_chemicals,
            token_type=EntityType.Chemicals.value,
            color=EntityColor.Chemicals.value,
            transaction=self.lmdb_session.chemicals_txn,
            id_str=entity_id_str,
            correct_synonyms=self.correct_synonyms,
            coor_obj_per_pdf_page=coor_obj_per_pdf_page,
            cropbox_per_page=cropbox_per_page,
        )

    def _annotate_compounds(
        self,
        entity_id_str: str,
        coor_obj_per_pdf_page: Dict[int, List[Union[LTChar, LTAnno]]],
        cropbox_per_page: Dict[int, Tuple[int, int]],
    ) -> Tuple[List[Annotation], Set[str]]:
        return self._get_annotation(
            tokens=self.matched_compounds,
            token_type=EntityType.Compounds.value,
            color=EntityColor.Compounds.value,
            transaction=self.lmdb_session.compounds_txn,
            id_str=entity_id_str,
            correct_synonyms=self.correct_synonyms,
            coor_obj_per_pdf_page=coor_obj_per_pdf_page,
            cropbox_per_page=cropbox_per_page,
        )

    def _annotate_proteins(
        self,
        entity_id_str: str,
        coor_obj_per_pdf_page: Dict[int, List[Union[LTChar, LTAnno]]],
        cropbox_per_page: Dict[int, Tuple[int, int]],
    ) -> Tuple[List[Annotation], Set[str]]:
        return self._get_annotation(
            tokens=self.matched_proteins,
            token_type=EntityType.Proteins.value,
            color=EntityColor.Proteins.value,
            transaction=self.lmdb_session.proteins_txn,
            id_str=entity_id_str,
            correct_synonyms=self.correct_synonyms,
            coor_obj_per_pdf_page=coor_obj_per_pdf_page,
            cropbox_per_page=cropbox_per_page,
        )

    def _annotate_species(
        self,
        entity_id_str: str,
        coor_obj_per_pdf_page: Dict[int, List[Union[LTChar, LTAnno]]],
        cropbox_per_page: Dict[int, Tuple[int, int]],
    ) -> Tuple[List[Annotation], Set[str]]:
        return self._get_annotation(
            tokens=self.matched_species,
            token_type=EntityType.Species.value,
            color=EntityColor.Species.value,
            transaction=self.lmdb_session.species_txn,
            id_str=entity_id_str,
            correct_synonyms=self.correct_synonyms,
            coor_obj_per_pdf_page=coor_obj_per_pdf_page,
            cropbox_per_page=cropbox_per_page,
        )

    def _annotate_diseases(
        self,
        entity_id_str: str,
        coor_obj_per_pdf_page: Dict[int, List[Union[LTChar, LTAnno]]],
        cropbox_per_page: Dict[int, Tuple[int, int]],
    ) -> Tuple[List[Annotation], Set[str]]:
        return self._get_annotation(
            tokens=self.matched_diseases,
            token_type=EntityType.Diseases.value,
            color=EntityColor.Diseases.value,
            transaction=self.lmdb_session.diseases_txn,
            id_str=entity_id_str,
            correct_synonyms=self.correct_synonyms,
            coor_obj_per_pdf_page=coor_obj_per_pdf_page,
            cropbox_per_page=cropbox_per_page,
        )

    def annotate(
        self,
        annotation_type: str,
        entity_id_str: str,
        coor_obj_per_pdf_page: Dict[int, List[Union[LTChar, LTAnno]]],
        cropbox_per_page: Dict[int, Tuple[int, int]],
    ) -> Tuple[List[Annotation], Set[str]]:
        funcs = {
            EntityType.Genes.value: self._annotate_genes,
            EntityType.Chemicals.value: self._annotate_chemicals,
            EntityType.Compounds.value: self._annotate_compounds,
            EntityType.Proteins.value: self._annotate_proteins,
            EntityType.Species.value: self._annotate_species,
            EntityType.Diseases.value: self._annotate_diseases,
        }

        annotate_entities = funcs[annotation_type]
        return annotate_entities(
            entity_id_str=entity_id_str,
            coor_obj_per_pdf_page=coor_obj_per_pdf_page,
            cropbox_per_page=cropbox_per_page,
        )

    def _remove_unwanted_keywords(
        self,
        matches: List[Annotation],
        unwanted_keywords: Set[str],
    ) -> List[Annotation]:
        """Remove any unwanted keywords from annotations.
        """
        new_matches = []
        for match in matches:
            if normalize_str(match.keyword) not in unwanted_keywords:
                new_matches.append(match)
        return new_matches

    def create_annotations(
        self,
        tokens: PDFTokenPositionsList,
    ) -> List[Annotation]:
        self._filter_tokens(tokens=tokens)

        matched_genes, unwanted_genes = self.annotate(
            annotation_type=EntityType.Genes.value,
            entity_id_str=EntityIdStr.Genes.value,
            coor_obj_per_pdf_page=tokens.coor_obj_per_pdf_page,
            cropbox_per_page=tokens.cropbox_per_page,
        )

        matched_chemicals, unwanted_chemicals = self.annotate(
            annotation_type=EntityType.Chemicals.value,
            entity_id_str=EntityIdStr.Chemicals.value,
            coor_obj_per_pdf_page=tokens.coor_obj_per_pdf_page,
            cropbox_per_page=tokens.cropbox_per_page,
        )

        matched_compounds, unwanted_compounds = self.annotate(
            annotation_type=EntityType.Compounds.value,
            entity_id_str=EntityIdStr.Compounds.value,
            coor_obj_per_pdf_page=tokens.coor_obj_per_pdf_page,
            cropbox_per_page=tokens.cropbox_per_page,
        )

        matched_proteins, unwanted_proteins = self.annotate(
            annotation_type=EntityType.Proteins.value,
            entity_id_str=EntityIdStr.Proteins.value,
            coor_obj_per_pdf_page=tokens.coor_obj_per_pdf_page,
            cropbox_per_page=tokens.cropbox_per_page,
        )

        matched_species, unwanted_species = self.annotate(
            annotation_type=EntityType.Species.value,
            entity_id_str=EntityIdStr.Species.value,
            coor_obj_per_pdf_page=tokens.coor_obj_per_pdf_page,
            cropbox_per_page=tokens.cropbox_per_page,
        )

        matched_diseases, unwanted_diseases = self.annotate(
            annotation_type=EntityType.Diseases.value,
            entity_id_str=EntityIdStr.Diseases.value,
            coor_obj_per_pdf_page=tokens.coor_obj_per_pdf_page,
            cropbox_per_page=tokens.cropbox_per_page,
        )

        unwanted_matches_set_list = [
            unwanted_genes,
            unwanted_chemicals,
            unwanted_compounds,
            unwanted_proteins,
            unwanted_species,
            unwanted_diseases,
        ]

        unwanted_keywords_set = set.union(*unwanted_matches_set_list)

        updated_matched_genes = self._remove_unwanted_keywords(
            matches=matched_genes,
            unwanted_keywords=unwanted_keywords_set,
        )

        updated_matched_chemicals = self._remove_unwanted_keywords(
            matches=matched_chemicals,
            unwanted_keywords=unwanted_keywords_set,
        )

        updated_matched_compounds = self._remove_unwanted_keywords(
            matches=matched_compounds,
            unwanted_keywords=unwanted_keywords_set,
        )

        updated_matched_proteins = self._remove_unwanted_keywords(
            matches=matched_proteins,
            unwanted_keywords=unwanted_keywords_set,
        )

        updated_matched_species = self._remove_unwanted_keywords(
            matches=matched_species,
            unwanted_keywords=unwanted_keywords_set,
        )

        updated_matched_diseases = self._remove_unwanted_keywords(
            matches=matched_diseases,
            unwanted_keywords=unwanted_keywords_set,
        )

        unified_annotations: List[Annotation] = []
        unified_annotations.extend(updated_matched_genes)
        unified_annotations.extend(updated_matched_chemicals)
        unified_annotations.extend(updated_matched_compounds)
        unified_annotations.extend(updated_matched_proteins)
        unified_annotations.extend(updated_matched_species)
        unified_annotations.extend(updated_matched_diseases)

        updated_unified_annotations: List[Annotation] = []
        unified_annotations_dict: Dict[int, List[Annotation]] = {}
        conflicting_annotations: Dict[int, List[Annotation]] = {}
        # use to keep track and not include when building the
        # updated_unified_annotations
        # will extend at the very end with correct list
        conflicting_annotations_hashes: Set[str] = set()

        # need to go page by page because coordinates
        # reset on each page
        for unified in unified_annotations:
            if unified.lo_location_offset == unified.hi_location_offset:
                # keyword is a single character
                updated_unified_annotations.append(unified)
            elif unified.page_number in unified_annotations_dict:
                unified_annotations_dict[unified.page_number].append(unified)
            else:
                unified_annotations_dict[unified.page_number] = [unified]

        for page_number, annotations in unified_annotations_dict.items():
            conflicts = self.find_conflicting_annotations(annotations)
            conflicting_annotations_hashes = set.union(*[
                {compute_hash(c.to_dict()) for c in conflicts},
                conflicting_annotations_hashes,
            ])

            conflicting_annotations[page_number] = conflicts

        for no_conflict_anno in unified_annotations:
            hashval = compute_hash(no_conflict_anno.to_dict())
            if hashval not in conflicting_annotations_hashes:
                updated_unified_annotations.append(no_conflict_anno)

        fixed_annotations: List[Annotation] = []

        for _, conflicting_annos in conflicting_annotations.items():
            # any annotations that remain are overlapping ones
            overlapping_annotations: Dict[str, Annotation] = {}
            tmp_fixed_annotations: List[Annotation] = []

            for annotation in conflicting_annos:
                hashval = compute_hash({
                    'keyword': annotation.keyword,
                    'lo_location_offset': annotation.lo_location_offset,
                    'hi_location_offset': annotation.hi_location_offset,
                })

                if hashval not in overlapping_annotations:
                    overlapping_annotations[hashval] = annotation
                else:
                    # exact intervals so choose entity precedence
                    conflicting_anno = overlapping_annotations.pop(hashval)

                    key1 = ENTITY_TYPE_PRECEDENCE[annotation.meta.keyword_type]
                    key2 = ENTITY_TYPE_PRECEDENCE[conflicting_anno.meta.keyword_type]

                    if key1 > key2:
                        overlapping_annotations[hashval] = annotation
                    else:
                        overlapping_annotations[hashval] = conflicting_anno

            # at this point all annotations
            # with exact duplicate intervals and exact
            # keywords are fixed
            tmp_fixed_annotations = [anno for _, anno in overlapping_annotations.items()]

            tmp_fixed_annotations_dict = {
                compute_hash(anno.to_dict()): anno for anno in tmp_fixed_annotations}
            tmp_fixed_annotations_hashes = {
                compute_hash(anno.to_dict()) for anno in tmp_fixed_annotations}

            tree = AnnotationIntervalTree()

            for annotation in tmp_fixed_annotations:
                tree.add(
                    AnnotationInterval(
                        begin=annotation.lo_location_offset,
                        end=annotation.hi_location_offset,
                        data=annotation,
                    ),
                )

            processed: Set[str] = set()
            for annotation in tmp_fixed_annotations:
                conflicts = tree.overlap(
                    begin=annotation.lo_location_offset,
                    end=annotation.hi_location_offset,
                )
                if len(conflicts) == 1:
                    fixed_annotations.extend(conflicts)
                else:
                    chosen_annotation = None
                    for conflict in conflicts:
                        if chosen_annotation is None:
                            chosen_annotation = conflict
                        else:
                            if conflict.keyword_length > chosen_annotation.keyword_length:
                                chosen_annotation = conflict
                            elif conflict.keyword_length == chosen_annotation.keyword_length:
                                key1 = ENTITY_TYPE_PRECEDENCE[conflict.meta.keyword_type]
                                key2 = ENTITY_TYPE_PRECEDENCE[chosen_annotation.meta.keyword_type]

                                if key1 > key2:
                                    chosen_annotation = conflict

                    hashval = compute_hash(chosen_annotation.to_dict())
                    if hashval not in processed:
                        fixed_annotations.append(chosen_annotation)
                        processed.add(hashval)

        updated_unified_annotations.extend(fixed_annotations)
        return updated_unified_annotations

    def find_conflicting_annotations(
        self,
        annotations: List[Annotation],
        # query: Optional[]
    ) -> List[Annotation]:
        """Find all of the annotations that have overlapping
        index intervals. The intervals implies the same keyword has been
        annotated several times, each as different entities. So we
        need to choose which entity to go with.

        TODO:

        Additionally, the overlap also tells us two keywords are
        either substrings of each other, or two keywords contain a
        common word between them. For the former, the longer and more
        specific keyword takes precedence. For the later, still
        need to consider how to handle.
        """
        conflicts = []
        tree = AnnotationIntervalTree()

        for annotation in annotations:
            tree.add(
                AnnotationInterval(
                    begin=annotation.lo_location_offset,
                    end=annotation.hi_location_offset,
                    data=annotation,
                ),
            )

        conflicts.extend(tree.split_overlaps())
        return conflicts
