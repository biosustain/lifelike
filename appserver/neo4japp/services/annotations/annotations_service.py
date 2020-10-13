import re

from bisect import bisect_left
from math import inf
from typing import cast, Dict, List, Optional, Set, Tuple, Union
from uuid import uuid4

from flask import current_app
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
    ENTITY_HYPERLINKS,
    ENTITY_TYPE_PRECEDENCE,
    GOOGLE_LINK,
    HOMO_SAPIENS_TAX_ID,
    NCBI_LINK,
    ORGANISM_DISTANCE_THRESHOLD,
    PDF_NEW_LINE_THRESHOLD,
    UNIPROT_LINK,
    WIKIPEDIA_LINK,
)
from .lmdb_dao import LMDBDao
from .util import normalize_str, standardize_str

from neo4japp.data_transfer_objects import (
    Annotation,
    EntityResults,
    GeneAnnotation,
    LMDBMatch,
    OrganismAnnotation,
    PDFTokenPositions,
    PDFTokenPositionsList,
    SpecifiedOrganismStrain
)
from neo4japp.exceptions import AnnotationError
from neo4japp.utils.logger import EventLog


class AnnotationsService:
    def __init__(
        self,
        annotation_neo4j: AnnotationsNeo4jService,
    ) -> None:
        self.annotation_neo4j = annotation_neo4j

        self.organism_frequency: Dict[str, int] = {}
        self.organism_locations: Dict[str, List[Tuple[int, int]]] = {}
        self.organism_categories: Dict[str, str] = {}

    def get_entities_to_annotate(
        self,
        chemical: bool = True,
        compound: bool = True,
        disease: bool = True,
        gene: bool = True,
        phenotype: bool = True,
        protein: bool = True,
        species: bool = True,
    ) -> List[Tuple[str, str]]:
        entity_type_and_id_pairs: List[Tuple[str, str]] = []

        if chemical:
            entity_type_and_id_pairs.append(
                (EntityType.CHEMICAL.value, EntityIdStr.CHEMICAL.value))

        if compound:
            entity_type_and_id_pairs.append(
                (EntityType.COMPOUND.value, EntityIdStr.COMPOUND.value))

        if disease:
            entity_type_and_id_pairs.append(
                (EntityType.DISEASE.value, EntityIdStr.DISEASE.value))

        if phenotype:
            entity_type_and_id_pairs.append(
                (EntityType.PHENOTYPE.value, EntityIdStr.PHENOTYPE.value))

        if species:
            # Order is IMPORTANT here
            # Species should always be annotated before Genes and Proteins
            entity_type_and_id_pairs.append(
                (EntityType.SPECIES.value, EntityIdStr.SPECIES.value))

        if protein:
            entity_type_and_id_pairs.append(
                (EntityType.PROTEIN.value, EntityIdStr.PROTEIN.value))

        if gene:
            entity_type_and_id_pairs.append(
                (EntityType.GENE.value, EntityIdStr.GENE.value))

        return entity_type_and_id_pairs

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
            except IndexError:
                raise AnnotationError(
                    'An indexing error occurred when creating annotation keyword objects.')
            except Exception:
                raise AnnotationError(
                    'Unexpected error when creating annotation keyword objects')

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
        entity_category: str,
        color: str,
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

        # entity here is data structure from LMDB
        # see services/annotations/util.py for definition
        keyword_starting_idx = char_indexes[0]
        keyword_ending_idx = char_indexes[-1]
        link_search_term = entity['synonym']
        if entity['id_type'] != DatabaseType.NCBI.value:
            hyperlink = ENTITY_HYPERLINKS[entity['id_type']]
        else:
            # type ignore, see https://github.com/python/mypy/issues/8277
            hyperlink = ENTITY_HYPERLINKS[entity['id_type']][token_type]  # type: ignore

        if entity['id_type'] == DatabaseType.MESH.value:
            hyperlink += entity_id[5:]  # type: ignore
        else:
            hyperlink += entity_id  # type: ignore

        if token_type == EntityType.SPECIES.value:
            organism_meta = OrganismAnnotation.OrganismMeta(
                category=entity_category,
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
        elif token_type == EntityType.GENE.value:
            gene_meta = GeneAnnotation.GeneMeta(
                category=entity_category,
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
        tokens: Dict[str, LMDBMatch],
        token_type: str,
        color: str,
        id_str: str,
        char_coord_objs_in_pdf: List[Union[LTChar, LTAnno]],
        cropbox_in_pdf: Tuple[int, int],
    ) -> List[Annotation]:
        """Create annotation objects for tokens.

        Assumption:
            - An entity in LMDB will always have a common name and synonym
                (1) this means a common name will have itself as a synonym

        Algorithm:
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
                    (1a) how to handle? Currently apply above as well (?)

        Returns list of matched annotations
        """
        matches: List[Annotation] = []
        tokens_lowercased = set([normalize_str(s) for s in list(tokens.keys())])

        for word, lmdb_match in tokens.items():
            for token_positions in lmdb_match.tokens:
                synonym_common_names_dict: Dict[str, Set[str]] = {}

                for entity in lmdb_match.entities:
                    entity_synonym = entity['synonym']
                    entity_common_name = entity['name']
                    if entity_synonym in synonym_common_names_dict:
                        synonym_common_names_dict[entity_synonym].add(normalize_str(entity_common_name))  # noqa
                    else:
                        synonym_common_names_dict[entity_synonym] = {normalize_str(entity_common_name)}  # noqa

                for entity in lmdb_match.entities:
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
                        entity_category=entity.get('category', ''),
                        color=color,
                    )
                    matches.append(annotation)
        return matches

    def _get_closest_entity_organism_pair(
        self,
        entity_position: PDFTokenPositions,
        organism_matches: Dict[str, str],
    ) -> Tuple[str, str, float]:
        """Gets the correct entity/organism pair for a given entity
        and its list of matching organisms.

        An entity name may match multiple organisms. To choose which organism to use,
        we first check for the closest one in the document. If two organisms are
        equal in distance, we choose the one that appears most frequently in the document.

        If the two organisms are both equidistant and equally frequent,
        we always prefer homo sapiens if it is either of the two entity.
        Otherwise, we choose the one we matched first.

        Currently used for proteins and genes.
        """

        char_indexes = list(entity_position.char_positions.keys())
        entity_location_lo = char_indexes[0]
        entity_location_hi = char_indexes[-1]

        closest_dist = inf
        curr_closest_organism = None

        for organism in organism_matches:
            try:
                if curr_closest_organism is None:
                    curr_closest_organism = organism

                min_organism_dist = inf

                # Get the closest instance of this organism
                for organism_pos in self.organism_locations[organism]:
                    organism_location_lo = organism_pos[0]
                    organism_location_hi = organism_pos[1]

                    if entity_location_lo > organism_location_hi:
                        new_organism_dist = entity_location_lo - organism_location_hi
                    else:
                        new_organism_dist = organism_location_lo - entity_location_hi

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
            except KeyError:
                raise AnnotationError(f'Organism ID {organism} does not exist.')  # noqa

        if curr_closest_organism is None:
            raise AnnotationError('Cannot get gene ID with empty organism match dict.')

        # Return the gene id of the organism with the highest priority
        return organism_matches[curr_closest_organism], curr_closest_organism, closest_dist

    def _annotate_genes(
        self,
        entity_id_str: str,
        char_coord_objs_in_pdf: List[Union[LTChar, LTAnno]],
        cropbox_in_pdf: Tuple[int, int],
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
        tokens: Dict[str, LMDBMatch] = self.matched_genes

        matches: List[Annotation] = []

        entity_tokenpos_pairs = []
        gene_names: Set[str] = set()
        for word, lmdb_match in tokens.items():
            for token_positions in lmdb_match.tokens:
                for entity in lmdb_match.entities:
                    entity_synonym = entity['name'] if entity.get('inclusion', None) else entity['synonym']  # noqa
                    gene_names.add(entity_synonym)

                    entity_tokenpos_pairs.append((entity, token_positions))

        gene_organism_matches = \
            self.annotation_neo4j.get_gene_to_organism_match_result(
                genes=list(gene_names),
                matched_organism_ids=list(self.organism_frequency.keys()),
            )

        # any genes not matched in KG fall back to specified organism
        fallback_gene_organism_matches = {}

        if self.specified_organism.synonym:
            fallback_gene_organism_matches = \
                self.annotation_neo4j.get_gene_to_organism_match_result(
                    genes=list(gene_names),
                    matched_organism_ids=[self.specified_organism.organism_id],
                )

        for entity, token_positions in entity_tokenpos_pairs:
            gene_id = None
            category = None
            entity_synonym = entity['name'] if entity.get('inclusion', None) else entity['synonym']  # noqa

            if entity_synonym in gene_organism_matches:
                gene_id, organism_id, closest_distance = self._get_closest_entity_organism_pair(
                    entity_position=token_positions,
                    organism_matches=gene_organism_matches[entity_synonym]
                )

                specified_organism_id = None
                if self.specified_organism.synonym and closest_distance > ORGANISM_DISTANCE_THRESHOLD:  # noqa
                    if fallback_gene_organism_matches.get(entity_synonym, None):
                        # if matched in KG then set to fallback strain
                        gene_id = fallback_gene_organism_matches[entity_synonym][self.specified_organism.organism_id]  # noqa
                        specified_organism_id = self.specified_organism.organism_id

                category = self.specified_organism.category if specified_organism_id else self.organism_categories[organism_id]  # noqa
            elif entity_synonym in fallback_gene_organism_matches:
                try:
                    gene_id = fallback_gene_organism_matches[entity_synonym][self.specified_organism.organism_id]  # noqa
                    category = self.specified_organism.category
                except KeyError:
                    raise AnnotationError('Failed to find gene id with fallback organism.')

            if gene_id and category:
                annotation = self._create_annotation_object(
                    char_coord_objs_in_pdf=char_coord_objs_in_pdf,
                    cropbox_in_pdf=cropbox_in_pdf,
                    token_positions=token_positions,
                    token_type=EntityType.GENE.value,
                    entity=entity,
                    entity_id=gene_id,
                    entity_category=category,
                    color=EntityColor.GENE.value,
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
            token_type=EntityType.CHEMICAL.value,
            color=EntityColor.CHEMICAL.value,
            id_str=entity_id_str,
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
            token_type=EntityType.COMPOUND.value,
            color=EntityColor.COMPOUND.value,
            id_str=entity_id_str,
            char_coord_objs_in_pdf=char_coord_objs_in_pdf,
            cropbox_in_pdf=cropbox_in_pdf,
        )

    def _annotate_proteins(
        self,
        entity_id_str: str,
        char_coord_objs_in_pdf: List[Union[LTChar, LTAnno]],
        cropbox_in_pdf: Tuple[int, int],
    ) -> List[Annotation]:
        """Nearly identical to `self._annotate_genes`. Return a list of
        protein annotations with the correct protein_id. If the protein
        was not matched in the knowledge graph, then keep the original
        protein_id.
        """
        tokens: Dict[str, LMDBMatch] = self.matched_proteins

        matches: List[Annotation] = []

        entity_tokenpos_pairs = []
        protein_names: Set[str] = set()
        for word, lmdb_match in tokens.items():
            for token_positions in lmdb_match.tokens:
                for entity in lmdb_match.entities:
                    protein_names.add(entity['synonym'])

                    entity_tokenpos_pairs.append((entity, token_positions))

        protein_organism_matches = \
            self.annotation_neo4j.get_proteins_to_organisms(
                proteins=list(protein_names),
                organisms=list(self.organism_frequency.keys()),
            )

        # any proteins not matched in KG fall back to specified organism
        fallback_protein_organism_matches = {}

        if self.specified_organism.synonym:
            fallback_protein_organism_matches = \
                self.annotation_neo4j.get_proteins_to_organisms(
                    proteins=list(protein_names),
                    organisms=[self.specified_organism.organism_id],
                )

        for entity, token_positions in entity_tokenpos_pairs:
            category = entity.get('category', '')
            protein_id = entity[EntityIdStr.PROTEIN.value]
            entity_synonym = entity['synonym']

            # TODO: code is identical to gene organism
            # move into function later if more than these two use
            if entity_synonym in protein_organism_matches:
                protein_id, organism_id, closest_distance = self._get_closest_entity_organism_pair(
                    entity_position=token_positions,
                    organism_matches=protein_organism_matches[entity_synonym]
                )

                specified_organism_id = None
                if self.specified_organism.synonym and closest_distance > ORGANISM_DISTANCE_THRESHOLD:  # noqa
                    if fallback_protein_organism_matches.get(entity_synonym, None):
                        # if matched in KG then set to fallback strain
                        protein_id = fallback_protein_organism_matches[entity_synonym][self.specified_organism.organism_id]  # noqa
                        specified_organism_id = self.specified_organism.organism_id

                category = self.specified_organism.category if specified_organism_id else self.organism_categories[organism_id]  # noqa
            elif entity_synonym in fallback_protein_organism_matches:
                try:
                    protein_id = fallback_protein_organism_matches[entity_synonym][self.specified_organism.organism_id]  # noqa
                    category = self.specified_organism.category
                except KeyError:
                    continue

            annotation = self._create_annotation_object(
                char_coord_objs_in_pdf=char_coord_objs_in_pdf,
                cropbox_in_pdf=cropbox_in_pdf,
                token_positions=token_positions,
                token_type=EntityType.PROTEIN.value,
                entity=entity,
                entity_id=protein_id,
                entity_category=category,
                color=EntityColor.PROTEIN.value,
            )
            matches.append(annotation)
        return matches

    def _annotate_local_species_inclusions(
        self,
        char_coord_objs_in_pdf: List[Union[LTChar, LTAnno]],
        cropbox_in_pdf: Tuple[int, int],
    ) -> List[Annotation]:
        """Similar to self._get_annotation() but for creating
        annotations of custom species.

        However, does not check if a synonym is used by multiple
        common names that all appear in the document, as assume
        user wants these custom species annotations to be
        annotated.
        """
        tokens = self.matched_local_species_inclusion

        custom_annotations: List[Annotation] = []

        for word, token_list in tokens.items():
            entities = self.local_species_inclusion.get(normalize_str(word), [])
            for token_positions in token_list:
                for entity in entities:
                    annotation = self._create_annotation_object(
                        char_coord_objs_in_pdf=char_coord_objs_in_pdf,
                        cropbox_in_pdf=cropbox_in_pdf,
                        token_positions=token_positions,
                        token_type=EntityType.SPECIES.value,
                        entity=entity,
                        entity_id=entity[EntityIdStr.SPECIES.value],
                        entity_category=entity.get('category', ''),
                        color=EntityColor.SPECIES.value,
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
            token_type=EntityType.SPECIES.value,
            color=EntityColor.SPECIES.value,
            id_str=entity_id_str,
            char_coord_objs_in_pdf=char_coord_objs_in_pdf,
            cropbox_in_pdf=cropbox_in_pdf,
        )

        species_inclusions = self._annotate_local_species_inclusions(
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
            for custom_anno in species_inclusions:
                if custom.get('rects', None):
                    if len(custom['rects']) == len(custom_anno.rects):
                        # check if center point for each rect in custom_anno.rects
                        # is in the corresponding rectangle from custom annotations
                        valid = all(list(map(has_center_point, custom['rects'], custom_anno.rects)))

                        # if center point is in custom annotation rectangle
                        # then add it to list
                        if valid:
                            filtered_custom_species_annotations.append(custom_anno)
                else:
                    raise AnnotationError(
                        'Manual annotations unexpectedly missing attribute "rects".')

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
            token_type=EntityType.DISEASE.value,
            color=EntityColor.DISEASE.value,
            id_str=entity_id_str,
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
            token_type=EntityType.PHENOTYPE.value,
            color=EntityColor.PHENOTYPE.value,
            id_str=entity_id_str,
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
            EntityType.CHEMICAL.value: self._annotate_chemicals,
            EntityType.COMPOUND.value: self._annotate_compounds,
            EntityType.PROTEIN.value: self._annotate_proteins,
            EntityType.SPECIES.value: self._annotate_species,
            EntityType.DISEASE.value: self._annotate_diseases,
            EntityType.PHENOTYPE.value: self._annotate_phenotypes,
            EntityType.GENE.value: self._annotate_genes,
        }

        annotate_entities = funcs[annotation_type]
        if annotation_type == EntityType.SPECIES.value:
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
        if isinstance(annotation.meta, OrganismAnnotation.OrganismMeta) and annotation.meta.category == OrganismCategory.VIRUSES.value:  # noqa
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
        if isinstance(annotation.meta, OrganismAnnotation.OrganismMeta) and annotation.meta.category == OrganismCategory.VIRUSES.value:  # noqa
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
                if annotation.meta.category == OrganismCategory.VIRUSES.value:  # noqa
                    entity_categories[HOMO_SAPIENS_TAX_ID] = OrganismCategory.EUKARYOTA.value

        return entity_frequency, matched_entity_locations, entity_categories

    def _get_fixed_false_positive_unified_annotations(
        self,
        annotations_list: List[Annotation],
        char_coord_objs_in_pdf: List[Union[LTChar, LTAnno]],
        word_index_dict: Dict[int, str]
    ) -> List[Annotation]:
        """Removes any false positive annotations.

        False positives occurred during our matching
        because we normalize the text from the pdf and
        the keys in lmdb.

        False positives are multi length word that
        got matched to a shorter length word due to
        normalizing in lmdb. Or words that get matched
        but the casing were not taken into account, e.g
        gene marA is correct, but mara is not.
        """
        fixed_annotations: List[Annotation] = []
        word_index_list = list(word_index_dict)

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
                if text_in_document == annotation.keyword:
                    # check abbreviations
                    # all uppercase and within parenthesis
                    if all([c.isupper() for c in annotation.text_in_document]) and \
                        (len(annotation.text_in_document) == 3 or len(annotation.text_in_document) == 4):  # noqa
                        begin = char_coord_objs_in_pdf[annotation.lo_location_offset - 1].get_text()  # noqa
                        end = char_coord_objs_in_pdf[annotation.hi_location_offset + 1].get_text()  # noqa
                        if begin == '(' and end == ')':
                            i = bisect_left(word_index_list, annotation.lo_location_offset)
                            abbrev = ''

                            for idx in word_index_list[i-len(annotation.text_in_document):i]:
                                abbrev += word_index_dict[idx][0]

                            if abbrev.lower() != annotation.text_in_document.lower():
                                fixed_annotations.append(annotation)
                        else:
                            fixed_annotations.append(annotation)
                    else:
                        fixed_annotations.append(annotation)
            else:
                # check abbreviations
                # all uppercase and within parenthesis
                if all([c.isupper() for c in annotation.text_in_document]) and \
                    (len(annotation.text_in_document) == 3 or len(annotation.text_in_document) == 4):  # noqa
                    begin = char_coord_objs_in_pdf[annotation.lo_location_offset - 1].get_text()  # noqa
                    end = char_coord_objs_in_pdf[annotation.hi_location_offset + 1].get_text()  # noqa
                    if begin == '(' and end == ')':
                        i = bisect_left(word_index_list, annotation.lo_location_offset)
                        abbrev = ''

                        for idx in word_index_list[i-len(annotation.text_in_document):i]:
                            abbrev += word_index_dict[idx][0]

                        if abbrev.lower() != annotation.text_in_document.lower():
                            fixed_annotations.append(annotation)
                    else:
                        fixed_annotations.append(annotation)
                else:
                    fixed_annotations.append(annotation)

        return fixed_annotations

    def _create_annotations(
        self,
        char_coord_objs_in_pdf: List[Union[LTChar, LTAnno]],
        cropbox_in_pdf: Tuple[int, int],
        types_to_annotate: List[Tuple[str, str]],
        organisms_from_custom_annotations: List[dict],
    ) -> List[Annotation]:
        """Create annotations.

        Args:
            tokens: list of PDFTokenPositions
            char_coord_objs_in_pdf: list of char objects from pdfminer
            cropbox_in_pdf: the mediabox/cropbox offset from pdfminer
                - boolean determines whether to check lmdb for that entity
            types_to_annotate: list of entity types to create annotations of
                - NOTE: IMPORTANT: should always match with `EntityRecognition.identify_entities()`
                - NOTE: IMPORTANT: Species should always be before Genes
                    - because species is used to do gene organism matching
                - e.g [
                    (EntityType.SPECIES.value, EntityIdStr.SPECIES.value),
                    (EntityType.CHEMICAL.value, EntityIdStr.CHEMICAL.value),
                    ...
                ]
        """
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
        entity_results: EntityResults,
        entity_type_and_id_pairs: List[Tuple[str, str]],
        specified_organism: SpecifiedOrganismStrain,
    ) -> List[Annotation]:
        """Create annotations based on semantic rules."""
        self.local_species_inclusion = entity_results.local_species_inclusion
        self.matched_local_species_inclusion = entity_results.matched_local_species_inclusion
        self.matched_chemicals = entity_results.matched_chemicals
        self.matched_compounds = entity_results.matched_compounds
        self.matched_diseases = entity_results.matched_diseases
        self.matched_genes = entity_results.matched_genes
        self.matched_phenotypes = entity_results.matched_phenotypes
        self.matched_proteins = entity_results.matched_proteins
        self.matched_species = entity_results.matched_species

        self.specified_organism = specified_organism

        annotations = self._create_annotations(
            char_coord_objs_in_pdf=tokens.char_coord_objs_in_pdf,
            cropbox_in_pdf=tokens.cropbox_in_pdf,
            types_to_annotate=entity_type_and_id_pairs,
            organisms_from_custom_annotations=custom_annotations,
        )
        return self._clean_annotations(
            annotations=annotations,
            char_coord_objs_in_pdf=tokens.char_coord_objs_in_pdf,
            word_index_dict=tokens.word_index_dict
        )

    def create_nlp_annotations(
        self,
        nlp_resp: List[dict],
        species_annotations: List[Annotation],
        char_coord_objs_in_pdf: List[Union[LTChar, LTAnno]],
        cropbox_in_pdf: Tuple[int, int],
        custom_annotations: List[dict],
        entity_type_and_id_pairs: List[Tuple[str, str]],
        word_index_dict: Dict[int, str]
    ) -> List[Annotation]:
        """Create annotations based on NLP."""
        nlp_annotations = self._create_annotations(
            char_coord_objs_in_pdf=char_coord_objs_in_pdf,
            cropbox_in_pdf=cropbox_in_pdf,
            types_to_annotate=entity_type_and_id_pairs,
            organisms_from_custom_annotations=custom_annotations,
        )

        unified_annotations = species_annotations + nlp_annotations

        # TODO: TEMP to keep track of things not matched in LMDB
        matched: Set[str] = set()
        predicted_set: Set[str] = set()
        for predicted in nlp_resp:
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

        current_app.logger.info(
            f'NLP TOKENS NOT MATCHED TO LMDB {not_matched}',
            extra=EventLog(event_type='annotations').to_dict()
        )
        return self._clean_annotations(
            annotations=unified_annotations,
            char_coord_objs_in_pdf=char_coord_objs_in_pdf,
            word_index_dict=word_index_dict
        )

    def _clean_annotations(
        self,
        annotations: List[Annotation],
        char_coord_objs_in_pdf: List[Union[LTChar, LTAnno]],
        word_index_dict: Dict[int, str]
    ) -> List[Annotation]:
        fixed_unified_annotations = self._get_fixed_false_positive_unified_annotations(
            annotations_list=annotations,
            char_coord_objs_in_pdf=char_coord_objs_in_pdf,
            word_index_dict=word_index_dict
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
        - it has same intervals.
        """
        updated_unified_annotations: List[Annotation] = []
        annotation_interval_dict: Dict[Tuple[int, int], List[Annotation]] = {}

        for unified in unified_annotations:
            if unified.lo_location_offset == unified.hi_location_offset:
                # keyword is a single character
                # should not have overlaps
                updated_unified_annotations.append(unified)
            else:
                interval_pair = (unified.lo_location_offset, unified.hi_location_offset)
                if interval_pair in annotation_interval_dict:
                    annotation_interval_dict[interval_pair].append(unified)
                else:
                    annotation_interval_dict[interval_pair] = [unified]

        tree = AnnotationIntervalTree([
            AnnotationInterval(
                begin=lo,
                end=hi
            ) for lo, hi in list(annotation_interval_dict)])

        # first clean all annotations with equal intervals
        # this means the same keyword was mapped to multiple entities
        for intervals, annotations in annotation_interval_dict.items():
            if len(annotations) > 1:
                chosen_annotation = None
                for annotation in annotations:
                    if chosen_annotation:
                        chosen_annotation = self.determine_entity_precedence(
                            anno1=chosen_annotation, anno2=annotation)
                    else:
                        chosen_annotation = annotation
                annotation_interval_dict[intervals] = [chosen_annotation]  # type: ignore

        overlap_ranges = tree.merge_overlaps()

        for (lo, hi) in overlap_ranges:
            overlaps = tree.overlap(lo, hi)

            annotations_to_fix: List[Annotation] = []

            for overlap in overlaps:
                annotations_to_fix += [anno for anno in annotation_interval_dict[(overlap.begin, overlap.end)]]  # noqa

            chosen_annotation = None

            for annotation in annotations_to_fix:
                if chosen_annotation:
                    chosen_annotation = self.determine_entity_precedence(
                        anno1=chosen_annotation, anno2=annotation)
                else:
                    chosen_annotation = annotation
            updated_unified_annotations.append(chosen_annotation)  # type: ignore

        return updated_unified_annotations

    def create_annotation_tree(
        self,
        annotation_intervals: List[Tuple[int, int]]
    ) -> AnnotationIntervalTree:
        return AnnotationIntervalTree(
            [AnnotationInterval(
                begin=lo,
                end=hi
            ) for lo, hi in annotation_intervals]
        )

    def determine_entity_precedence(
        self,
        anno1: Annotation,
        anno2: Annotation,
    ) -> Annotation:
        key1 = ENTITY_TYPE_PRECEDENCE[anno1.meta.type]
        key2 = ENTITY_TYPE_PRECEDENCE[anno2.meta.type]

        # if custom phenotype and MESH phenotype
        # then choose MESH
        if ((anno1.meta.type == EntityType.PHENOTYPE.value and
                anno2.meta.type == EntityType.PHENOTYPE.value) and
            (anno1.lo_location_offset == anno2.lo_location_offset and
                anno1.hi_location_offset == anno2.hi_location_offset)):  # noqa
            if anno1.meta.id_type == DatabaseType.MESH.value:
                return anno1
            elif anno2.meta.id_type == DatabaseType.MESH.value:
                return anno2

        # only do special gene vs protein comparison if they have
        # exact intervals
        # because that means the same normalized text was matched
        # to both
        if ((anno1.meta.type == EntityType.PROTEIN.value or
                anno1.meta.type == EntityType.GENE.value) and
            (anno2.meta.type == EntityType.PROTEIN.value or
                anno2.meta.type == EntityType.GENE.value) and
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

    def get_matching_manual_annotations(
        self,
        keyword: str,
        keyword_type: str,
        tokens: PDFTokenPositionsList
    ):
        """Returns coordinate positions and page numbers
        for all matching terms in the document
        """
        matches = []
        for token in tokens.token_positions:
            if keyword_type == EntityType.GENE.value:
                if token.keyword != keyword:
                    continue
            elif standardize_str(token.keyword) != standardize_str(keyword):
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
