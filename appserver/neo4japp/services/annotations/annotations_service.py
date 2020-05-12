import json
import re

from math import inf
from string import ascii_lowercase, digits, punctuation
from typing import cast, Dict, List, Optional, Set, Tuple, Union

from pdfminer.layout import LTAnno, LTChar

from .annotation_interval_tree import (
    AnnotationInterval,
    AnnotationIntervalTree,
)
from .constants import (
    DatabaseType,
    EntityColor,
    EntityIdStr,
    EntityType,
    OrganismCategory,
    COMMON_WORDS,
    ENTITY_HYPERLINKS,
    ENTITY_TYPE_PRECEDENCE,
    GOOGLE_LINK,
    HOMO_SAPIENS_TAX_ID,
    NCBI_LINK,
    PDF_NEW_LINE_THRESHOLD,
    TYPO_SYNONYMS,
    UNIPROT_LINK,
    WIKIPEDIA_LINK,
)
from .lmdb_dao import LMDBDao
from .util import normalize_str

from neo4japp.data_transfer_objects import (
    Annotation,
    PDFTokenPositions,
    PDFTokenPositionsList,
    OrganismAnnotation,
)
from neo4japp.database import get_hybrid_neo4j_postgres_service
from neo4japp.util import compute_hash


class AnnotationsService:
    def __init__(
        self,
        lmdb_session: LMDBDao,
    ) -> None:
        self.regex_for_floats = r'^-?\d+(?:\.\d+)?$'

        self.lmdb_session = lmdb_session

        self.hybrid_neo4j_postgres_service = get_hybrid_neo4j_postgres_service()

        # for word tokens that are typos
        self.correct_synonyms: Dict[str, str] = {}

        self.matched_genes: Dict[str, List[PDFTokenPositions]] = {}
        self.matched_chemicals: Dict[str, List[PDFTokenPositions]] = {}
        self.matched_compounds: Dict[str, List[PDFTokenPositions]] = {}
        self.matched_proteins: Dict[str, List[PDFTokenPositions]] = {}
        self.matched_species: Dict[str, List[PDFTokenPositions]] = {}
        self.matched_diseases: Dict[str, List[PDFTokenPositions]] = {}
        self.matched_phenotypes: Dict[str, List[PDFTokenPositions]] = {}

        self.validated_genes_tokens: Set[str] = set()
        self.validated_chemicals_tokens: Set[str] = set()
        self.validated_compounds_tokens: Set[str] = set()
        self.validated_proteins_tokens: Set[str] = set()
        self.validated_species_tokens: Set[str] = set()
        self.validated_diseases_tokens: Set[str] = set()
        self.validated_phenotypes_tokens: Set[str] = set()

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

        phenotype_val = self.lmdb_session.phenotypes_txn.get(lookup_key)
        if phenotype_val and hashval not in self.validated_phenotypes_tokens:
            self.validated_phenotypes_tokens.add(hashval)
            if word in self.matched_phenotypes:
                self.matched_phenotypes[word].append(token)
            else:
                self.matched_phenotypes[word] = [token]

        return [
            gene_val, chem_val, comp_val,
            protein_val, species_val, diseases_val,
            phenotype_val,
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
        coor_obj_per_pdf_page: Dict[int, List[Union[LTChar, LTAnno]]],
        cropbox_per_page: Dict[int, Tuple[int, int]],
        token_type: str,
        entity: dict,
        entity_id: str,
        color: str,
    ):
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
        link_search_term = entity['name']
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
                category=entity['category'],
                keyword_type=token_type,
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
            )
            # the `keywords` property here is to allow us to know
            # what coordinates map to what text in the PDF
            # we want to actually use the real name inside LMDB
            # for the `keyword` and `keyword_length` properties
            return OrganismAnnotation(
                page_number=token_positions.page_number,
                rects=[pos.positions for pos in keyword_positions],  # type: ignore
                keywords=[k.value for k in keyword_positions],
                keyword=link_search_term,
                keyword_length=len(link_search_term),
                lo_location_offset=keyword_starting_idx,
                hi_location_offset=keyword_ending_idx,
                meta=organism_meta,
            )
        else:
            meta = Annotation.Meta(
                keyword_type=token_type,
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
            )
            return Annotation(
                page_number=token_positions.page_number,
                rects=[pos.positions for pos in keyword_positions],  # type: ignore
                keywords=[k.value for k in keyword_positions],
                keyword=link_search_term,
                keyword_length=len(link_search_term),
                lo_location_offset=keyword_starting_idx,
                hi_location_offset=keyword_ending_idx,
                meta=meta,
            )

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
                    matches.append(self._create_annotation_object(
                        coor_obj_per_pdf_page=coor_obj_per_pdf_page,
                        cropbox_per_page=cropbox_per_page,
                        token_positions=token_positions,
                        token_type=token_type,
                        entity=entity,
                        entity_id=entity_id,
                        color=color,
                    ))
                else:
                    unwanted_matches.add(word)
        return matches, unwanted_matches

    def _get_gene_id_for_annotation(
        self,
        word: str,
        token_positions: PDFTokenPositions,
        match_result: Dict[str, Dict[str, str]],
        matched_organism_locations: Dict[int, Dict[str, List[Tuple[int, int]]]],
        organism_frequency: Dict[str, int],
    ):
        """Gets the correct gene ID for a given gene and its list of matching organisms.

        A gene name may match multiple organisms. To choose which organism to use, we first
        check for the closest one in the document. Currently we are limited to checking only
        the page the gene occurs on. If no matching organism is on the page, then we check
        which organism in the matching list appears most frequently in the document.
        """
        char_indexes = list(token_positions.char_positions.keys())
        keyword_starting_idx = char_indexes[0]
        keyword_ending_idx = char_indexes[-1]

        # If a gene was matched to at least one organism in the document,
        # we have to get the corresponding gene data. If a gene matches
        # more than one organism, we first check for the closest organism
        # on the current page.
        organism_to_gene_pairs = match_result[word]
        organisms_on_this_page = matched_organism_locations.get(token_positions.page_number, dict())  # noqa
        organisms_found = set(organism_to_gene_pairs.keys()).intersection(set(organisms_on_this_page.keys()))  # noqa
        if len(organisms_on_this_page) > 0 and len(organisms_found) > 0:
            closest_organism = str()
            smallest_distance = inf

            for organism_id in organisms_found:
                for organism_occurrence in organisms_on_this_page[organism_id]:
                    organism_starting_idx, organism_ending_idx = organism_occurrence
                    if keyword_starting_idx > organism_ending_idx:
                        distance_from_gene_to_this_organism = keyword_starting_idx - organism_ending_idx  # noqa
                    else:
                        distance_from_gene_to_this_organism = organism_starting_idx - keyword_ending_idx  # noqa

                    # If the new distance is the same as the current closest distance, and either
                    # the current closest organism is homo sapiens, or the closest organism ISN'T
                    # homo sapiens AND the new organism IS, then prefer homo sapiens.
                    if (distance_from_gene_to_this_organism == smallest_distance and
                            (closest_organism == HOMO_SAPIENS_TAX_ID or
                                (closest_organism != HOMO_SAPIENS_TAX_ID and organism_id == HOMO_SAPIENS_TAX_ID))):  # noqa
                        closest_organism = HOMO_SAPIENS_TAX_ID
                    elif distance_from_gene_to_this_organism < smallest_distance:
                        closest_organism = organism_id
                        smallest_distance = distance_from_gene_to_this_organism
            return organism_to_gene_pairs[closest_organism]
        # If there is no closest match on the page,
        # then we use the one with the highest frequency within the document.
        # We may fine-tune this later.
        else:
            most_frequent_organism = str()
            greatest_frequency = 0

            for organism_id in organism_to_gene_pairs.keys():
                if organism_frequency[organism_id] > greatest_frequency:
                    greatest_frequency = organism_frequency[organism_id]
                    most_frequent_organism = organism_id

            return organism_to_gene_pairs[most_frequent_organism]

    def _annotate_genes(
        self,
        matched_organism_locations: Dict[int, Dict[str, List[Tuple[int, int]]]],
        organism_frequency: Dict[str, int],
        coor_obj_per_pdf_page: Dict[int, List[Union[LTChar, LTAnno]]],
        cropbox_per_page: Dict[int, Tuple[int, int]],
    ) -> Tuple[List[Annotation], Set[str]]:
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
        """
        tokens: Dict[str, List[PDFTokenPositions]] = self.matched_genes
        token_type: str = EntityType.Genes.value
        color: str = EntityColor.Genes.value
        transaction = self.lmdb_session.genes_txn
        correct_synonyms: Dict[str, str] = self.correct_synonyms

        matches: List[Annotation] = []
        unwanted_matches: Set[str] = set()

        tokens_lowercased = set(tokens.keys())

        match_result = self.hybrid_neo4j_postgres_service.get_gene_to_organism_match_result(
            genes=list(tokens.keys()),
            matched_organism_ids=list(organism_frequency.keys()),
        )

        for word, token_positions_list in tokens.items():
            # If the "gene" is not matched to any organism in the paper, ignore it
            if word not in match_result.keys():
                continue

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
                        for _, v in entity['common_name'].items():
                            if v in tokens_lowercased:
                                common_name_count += 1
                else:
                    common_name_count = 1

                if common_name_count == 1:
                    entity_id = self._get_gene_id_for_annotation(
                        word=word,
                        token_positions=token_positions,
                        match_result=match_result,
                        matched_organism_locations=matched_organism_locations,
                        organism_frequency=organism_frequency,
                    )

                    matches.append(self._create_annotation_object(
                        coor_obj_per_pdf_page=coor_obj_per_pdf_page,
                        cropbox_per_page=cropbox_per_page,
                        token_positions=token_positions,
                        token_type=token_type,
                        entity=entity,
                        entity_id=entity_id,
                        color=color,
                    ))
                else:
                    unwanted_matches.add(word)
        return matches, unwanted_matches

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

    def _annotate_phenotypes(
        self,
        entity_id_str: str,
        coor_obj_per_pdf_page: Dict[int, List[Union[LTChar, LTAnno]]],
        cropbox_per_page: Dict[int, Tuple[int, int]],
    ) -> Tuple[List[Annotation], Set[str]]:
        return self._get_annotation(
            tokens=self.matched_phenotypes,
            token_type=EntityType.Phenotypes.value,
            color=EntityColor.Phenotypes.value,
            transaction=self.lmdb_session.phenotypes_txn,
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
            EntityType.Chemicals.value: self._annotate_chemicals,
            EntityType.Compounds.value: self._annotate_compounds,
            EntityType.Proteins.value: self._annotate_proteins,
            EntityType.Species.value: self._annotate_species,
            EntityType.Diseases.value: self._annotate_diseases,
            EntityType.Phenotypes.value: self._annotate_phenotypes,
        }

        annotate_entities = funcs[annotation_type]
        return annotate_entities(
            entity_id_str=entity_id_str,
            coor_obj_per_pdf_page=coor_obj_per_pdf_page,
            cropbox_per_page=cropbox_per_page,
        )

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

        return entity_frequency

    def _get_entity_frequency(
        self,
        annotations: List[Annotation],
    ) -> Dict[str, int]:
        """Takes as input a list of annotation objects (intended to be of a single entity type).

        Returns the frequency of each annotation entity within the document.
        """
        entity_frequency: Dict[str, int] = dict()
        for annotation in annotations:
            entity_frequency = self._update_entity_frequency_map(
                entity_frequency=entity_frequency,
                annotation=annotation,
            )
        return entity_frequency

    def _update_entity_location_map(
        self,
        matched_entity_locations: Dict[int, Dict[str, List[Tuple[int, int]]]],
        annotation: Annotation,
    ) -> Dict[int, Dict[str, List[Tuple[int, int]]]]:
        def _check_if_human_id_should_be_added(
            matched_entity_locations: Dict[int, Dict[str, List[Tuple[int, int]]]],
            annotation: Annotation,
        ):
            if isinstance(annotation, OrganismAnnotation) and annotation.meta.category == OrganismCategory.Viruses.value:  # noqa
                if matched_entity_locations[annotation.page_number].get(HOMO_SAPIENS_TAX_ID, None) is not None:  # noqa
                    matched_entity_locations[annotation.page_number][HOMO_SAPIENS_TAX_ID].append(  # noqa
                        (annotation.lo_location_offset, annotation.hi_location_offset)
                    )
                else:
                    matched_entity_locations[annotation.page_number][HOMO_SAPIENS_TAX_ID] = [
                        (annotation.lo_location_offset, annotation.hi_location_offset)
                    ]
            return matched_entity_locations

        if matched_entity_locations.get(annotation.page_number, None) is not None:
            if matched_entity_locations[annotation.page_number].get(annotation.meta.id, None) is not None:  # noqa
                matched_entity_locations[annotation.page_number][annotation.meta.id].append(
                    (annotation.lo_location_offset, annotation.hi_location_offset)
                )
            else:
                matched_entity_locations[annotation.page_number][annotation.meta.id] = [
                    (annotation.lo_location_offset, annotation.hi_location_offset)
                ]

            # If the annotation represents a virus, then also mark this location as a human
            # annotation
            matched_entity_locations = _check_if_human_id_should_be_added(
                matched_entity_locations=matched_entity_locations,
                annotation=annotation,
            )
        else:
            matched_entity_locations[annotation.page_number] = {
                annotation.meta.id: [(annotation.lo_location_offset, annotation.hi_location_offset)]
            }

            # If the annotation represents a virus, then also mark this location as a human
            # annotation
            matched_entity_locations = _check_if_human_id_should_be_added(
                matched_entity_locations=matched_entity_locations,
                annotation=annotation,
            )

        return matched_entity_locations

    def _get_entity_locations(
        self,
        annotations: List[Annotation],
    ) -> Dict[int, Dict[str, List[Tuple[int, int]]]]:
        """Takes as input a list of annotation objects (intended to be of a single entity type).

        Returns the locations of the annotation entities within the document.
        """
        matched_entity_locations: Dict[int, Dict[str, List[Tuple[int, int]]]] = {}
        for annotation in annotations:
            matched_entity_locations = self._update_entity_location_map(
                matched_entity_locations=matched_entity_locations,
                annotation=annotation,
            )
        return matched_entity_locations

    def _get_entity_frequency_and_locations(
        self,
        annotations: List[Annotation],
    ) -> Tuple[Dict[str, int], Dict[int, Dict[str, List[Tuple[int, int]]]]]:
        """Takes as input a list of annotation objects (intended to be of a single entity type).

        Returns the frequency of the annotation entities, and their locations within the document.
        """
        matched_entity_locations: Dict[int, Dict[str, List[Tuple[int, int]]]] = {}
        entity_frequency: Dict[str, int] = dict()

        for annotation in annotations:
            entity_frequency = self._update_entity_frequency_map(
                entity_frequency=entity_frequency,
                annotation=annotation,
            )
            matched_entity_locations = self._update_entity_location_map(
                matched_entity_locations=matched_entity_locations,
                annotation=annotation,
            )

        return entity_frequency, matched_entity_locations

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

    def _create_initial_annotations_list(
        self,
        tokens: PDFTokenPositionsList,
    ) -> Tuple[List[List[Annotation]], List[Set[str]]]:
        """Takes as input a list of keyword tokens.

        Returns an initial list of candidate annotation objects, as well
        as a list of keyword sets for words we intend to drop from our
        annotation list.
        """
        entity_type_and_id_pairs = [
            (EntityType.Species.value, EntityIdStr.Species.value),
            (EntityType.Chemicals.value, EntityIdStr.Chemicals.value),
            (EntityType.Compounds.value, EntityIdStr.Compounds.value),
            (EntityType.Proteins.value, EntityIdStr.Proteins.value),
            (EntityType.Diseases.value, EntityIdStr.Diseases.value),
            (EntityType.Phenotypes.value, EntityIdStr.Phenotypes.value),
        ]

        matched_list, unwanted_matches_set_list = [], []

        for entity_type, entity_id_str in entity_type_and_id_pairs:
            matched, unwanted = self.annotate(
                annotation_type=entity_type,
                entity_id_str=entity_id_str,
                coor_obj_per_pdf_page=tokens.coor_obj_per_pdf_page,
                cropbox_per_page=tokens.cropbox_per_page,
            )
            matched_list.append(matched)
            unwanted_matches_set_list.append(unwanted)

        return matched_list, unwanted_matches_set_list

    def _get_fixed_unified_annotations(
        self,
        matched_list: List[List[Annotation]],
        unwanted_matches_set_list: Set[str],
    ) -> List[Annotation]:
        """Takes as input a list of annotations, and a set of unwanted keywords.
        Annotations and keywords may span multiple entity types (e.g. compounds,
        chemicals, organisms, etc.).

        Returns an updated list of annotations with
        undesired annotations stripped out, and with conflicting annotations
        resolved.
        """
        updated_annotations = []
        for matched_entities in matched_list:
            updated_annotations.append(
                self._remove_unwanted_keywords(
                    matches=matched_entities,
                    unwanted_keywords=unwanted_matches_set_list,
                )
            )

        unified_annotations: List[Annotation] = []
        for updated_annotation_set in updated_annotations:
            unified_annotations.extend(updated_annotation_set)

        return self.fix_conflicting_annotations(
            unified_annotations=unified_annotations
        )

    def create_annotations(
        self,
        tokens: PDFTokenPositionsList,
    ) -> List[Annotation]:
        self._filter_tokens(tokens=tokens)

        # Get matches for Species, Chemicals, Compounds, Diseases, Proteins, and Phenotypes
        matched_list, unwanted_matches_list = self._create_initial_annotations_list(
            tokens=tokens,
        )

        # Do first round of filtering on the matched list
        unwanted_matches_set_list = set.union(*unwanted_matches_list)
        fixed_unified_annotations = self._get_fixed_unified_annotations(
            matched_list=matched_list,
            unwanted_matches_set_list=unwanted_matches_set_list,
        )

        # Create a list of species annotations
        matched_reduced_species = [
            anno for anno in fixed_unified_annotations
            if anno.meta.keyword_type == EntityType.Species.value
        ]

        organism_frequency, matched_organism_locations = self._get_entity_frequency_and_locations(
            annotations=matched_reduced_species,
        )

        # Match genes with the reduced set of organisms
        matched_genes, unwanted_genes = self._annotate_genes(
            matched_organism_locations=matched_organism_locations,
            organism_frequency=organism_frequency,
            coor_obj_per_pdf_page=tokens.coor_obj_per_pdf_page,
            cropbox_per_page=tokens.cropbox_per_page,
        )
        matched_list.append(matched_genes)
        unwanted_matches_list.append(unwanted_genes)

        # Do second round of filtering, now with genes
        unwanted_matches_set_list = set.union(*unwanted_matches_list)
        fixed_unified_annotations = self._get_fixed_unified_annotations(
            matched_list=matched_list,
            unwanted_matches_set_list=unwanted_matches_set_list,
        )

        return fixed_unified_annotations

    def fix_conflicting_annotations(
        self,
        unified_annotations: List[Annotation],
    ) -> List[Annotation]:
        """Fix any conflicting annotations.

        An annotation is a conflict if it has overlapping
        `lo_location_offset` and `hi_location_offset` with another annotation
        or if it has adjacent intervals, meaning a `hi_location_offset` equals
        the `lo_location_offset` of another annotation.
        """
        updated_unified_annotations: List[Annotation] = []
        unified_annotations_dict: Dict[int, List[Annotation]] = {}

        # need to go page by page because coordinates
        # reset on each page
        # TODO: JIRA LL-581
        for unified in unified_annotations:
            if unified.lo_location_offset == unified.hi_location_offset:
                # keyword is a single character
                # should not have overlaps
                updated_unified_annotations.append(unified)
            elif unified.page_number in unified_annotations_dict:
                unified_annotations_dict[unified.page_number].append(unified)
            else:
                unified_annotations_dict[unified.page_number] = [unified]

        annotations_to_clean: Dict[int, List[Annotation]] = {}

        for page_number, annotations in unified_annotations_dict.items():
            tree = self.create_annotation_tree(annotations=annotations)
            # first clean all annotations with equal intervals
            # this means the same keyword was mapped to multiple entities
            cleaned_of_equal_intervals = tree.merge_equals(
                data_reducer=self.determine_entity_precedence)
            annotations_to_clean[page_number] = cleaned_of_equal_intervals

        fixed_annotations = self._remove_overlapping_annotations(
            conflicting_annotations=annotations_to_clean)

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
        if anno1.keyword_length > anno2.keyword_length:
            return anno1
        elif anno1.keyword_length == anno2.keyword_length:
            key1 = ENTITY_TYPE_PRECEDENCE[anno1.meta.keyword_type]
            key2 = ENTITY_TYPE_PRECEDENCE[anno2.meta.keyword_type]

            if key1 > key2:
                return anno1
            else:
                return anno2
        else:
            return anno2

    def _remove_overlapping_annotations(
        self,
        conflicting_annotations: Dict[int, List[Annotation]],
    ) -> List[Annotation]:
        """Remove annotations based on these rules:

        If overlapping, then consider longest length.
            - If overlapping but same length, then consider
            entity precedence.
        """
        fixed_annotations: List[Annotation] = []

        for _, conflicting_annos in conflicting_annotations.items():
            if conflicting_annos:
                tree = self.create_annotation_tree(annotations=conflicting_annos)
                fixed_annotations.extend(
                    tree.merge_overlaps(
                        data_reducer=self.determine_entity_precedence,
                    ),
                )
        return fixed_annotations
