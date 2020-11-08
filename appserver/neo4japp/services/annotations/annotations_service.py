import re

from bisect import bisect_left
from math import inf
from typing import cast, Dict, List, Set, Tuple, Union
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
    ABBREVIATION_WORD_LENGTH,
    ENTITY_HYPERLINKS,
    ENTITY_TYPE_PRECEDENCE,
    HOMO_SAPIENS_TAX_ID,
    ORGANISM_DISTANCE_THRESHOLD,
    PDF_NEW_LINE_THRESHOLD,
    SEARCH_LINKS,
)
from .lmdb_dao import LMDBDao
from .util import normalize_str, standardize_str

from neo4japp.data_transfer_objects import (
    Annotation,
    EntityResults,
    GeneAnnotation,
    LMDBMatch,
    OrganismAnnotation,
    PDFChar,
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
        anatomy: bool = True,
        chemical: bool = True,
        compound: bool = True,
        disease: bool = True,
        food: bool = True,
        gene: bool = True,
        phenotype: bool = True,
        protein: bool = True,
        species: bool = True,
        company: bool = True,
        entity: bool = True
    ) -> List[Tuple[str, str]]:
        entity_type_and_id_pairs: List[Tuple[str, str]] = []

        if anatomy:
            entity_type_and_id_pairs.append(
                (EntityType.ANATOMY.value, EntityIdStr.ANATOMY.value))

        if chemical:
            entity_type_and_id_pairs.append(
                (EntityType.CHEMICAL.value, EntityIdStr.CHEMICAL.value))

        if compound:
            entity_type_and_id_pairs.append(
                (EntityType.COMPOUND.value, EntityIdStr.COMPOUND.value))

        if disease:
            entity_type_and_id_pairs.append(
                (EntityType.DISEASE.value, EntityIdStr.DISEASE.value))

        if food:
            entity_type_and_id_pairs.append(
                (EntityType.FOOD.value, EntityIdStr.FOOD.value))

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

        if company:
            entity_type_and_id_pairs.append(
                (EntityType.COMPANY.value, EntityIdStr.COMPANY.value))

        if entity:
            entity_type_and_id_pairs.append(
                (EntityType.ENTITY.value, EntityIdStr.ENTITY.value))

        return entity_type_and_id_pairs

    def _create_keyword_objects(
        self,
        curr_page_coor_obj: List[PDFChar],
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
            curr_page_coor_obj: List[PDFChar],
            pos_idx: int,
        ) -> int:
            i = pos_idx
            while i >= 0 and curr_page_coor_obj[i].space:
                i -= 1
            return i

        start_lower_x = None
        start_lower_y = None
        end_upper_x = None
        end_upper_y = None

        keyword = ''
        for i, pos_idx in enumerate(indexes):
            try:
                if not curr_page_coor_obj[pos_idx].space:
                    lower_x = curr_page_coor_obj[pos_idx].x0
                    lower_y = curr_page_coor_obj[pos_idx].y0
                    upper_x = curr_page_coor_obj[pos_idx].x1
                    upper_y = curr_page_coor_obj[pos_idx].y1

                    if (start_lower_x is None and
                            start_lower_y is None and
                            end_upper_x is None and
                            end_upper_y is None):
                        start_lower_x = lower_x
                        start_lower_y = lower_y
                        end_upper_x = upper_x
                        end_upper_y = upper_y

                        keyword += curr_page_coor_obj[pos_idx].text
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

                                keyword += curr_page_coor_obj[pos_idx].text
                        else:
                            if upper_y > end_upper_y:
                                end_upper_y = upper_y

                            if upper_x > end_upper_x:
                                end_upper_x = upper_x

                            keyword += curr_page_coor_obj[pos_idx].text
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
        char_coord_objs_in_pdf: List[PDFChar],
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
        link_search_term = token_positions.keyword
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
                    **{domain: url + link_search_term for domain, url in SEARCH_LINKS.items()}
                ),
                all_text=entity['synonym'],
            )
            # the `keywords` property here is to allow us to know
            # what coordinates map to what text in the PDF
            # we want to actually use the real name inside LMDB
            # for the `keyword` property
            annotation = OrganismAnnotation(
                page_number=token_positions.page_number,
                rects=[pos.positions for pos in keyword_positions],  # type: ignore
                keywords=[k.value for k in keyword_positions],
                keyword=entity['synonym'],
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
                    **{domain: url + link_search_term for domain, url in SEARCH_LINKS.items()}
                ),
                all_text=entity['synonym'],
            )
            annotation = GeneAnnotation(
                page_number=token_positions.page_number,
                rects=[pos.positions for pos in keyword_positions],  # type: ignore
                keywords=[k.value for k in keyword_positions],
                keyword=entity['synonym'],
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
                    **{domain: url + link_search_term for domain, url in SEARCH_LINKS.items()}
                ),
                all_text=entity['synonym'],
            )
            annotation = Annotation(
                page_number=token_positions.page_number,
                rects=[pos.positions for pos in keyword_positions],  # type: ignore
                keywords=[k.value for k in keyword_positions],
                keyword=entity['synonym'],
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
        char_coord_objs_in_pdf: List[PDFChar],
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

                    try:
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
                    except KeyError:
                        continue
                    else:
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

    def _annotate_type_gene(
        self,
        entity_id_str: str,
        char_coord_objs_in_pdf: List[PDFChar],
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
        tokens: Dict[str, LMDBMatch] = self.matched_type_gene

        matches: List[Annotation] = []

        entity_tokenpos_pairs = []
        gene_names: Set[str] = set()
        for word, lmdb_match in tokens.items():
            for token_positions in lmdb_match.tokens:
                for entity in lmdb_match.entities:
                    entity_synonym = entity['name'] if entity.get('inclusion', None) else entity['synonym']  # noqa
                    gene_names.add(entity_synonym)

                    entity_tokenpos_pairs.append((entity, token_positions))

        gene_names_list = list(gene_names)

        gene_organism_matches = \
            self.annotation_neo4j.get_gene_to_organism_match_result(
                genes=gene_names_list,
                matched_organism_ids=list(self.organism_frequency.keys()),
            )

        # any genes not matched in KG fall back to specified organism
        fallback_gene_organism_matches = {}

        if self.specified_organism.synonym:
            fallback_gene_organism_matches = \
                self.annotation_neo4j.get_gene_to_organism_match_result(
                    genes=gene_names_list,
                    matched_organism_ids=[self.specified_organism.organism_id],
                )

        for entity, token_positions in entity_tokenpos_pairs:
            gene_id = None
            category = None
            try:
                entity_synonym = entity['name'] if entity.get('inclusion', None) else entity['synonym']  # noqa
            except KeyError:
                continue
            else:
                organisms_to_match: Dict[str, str] = {}
                if entity_synonym in gene_organism_matches:
                    try:
                        # prioritize common name match over synonym
                        organisms_to_match = gene_organism_matches[entity_synonym][entity_synonym]
                    except KeyError:
                        # only take the first gene for the organism
                        # no way for us to infer which to use
                        # logic moved from annotations_neo4j_service.py
                        for d in list(gene_organism_matches[entity_synonym].values()):
                            key = next(iter(d))
                            if key not in organisms_to_match:
                                organisms_to_match[key] = d[key]

                    gene_id, organism_id, closest_distance = self._get_closest_entity_organism_pair(
                        entity_position=token_positions,
                        organism_matches=organisms_to_match
                    )

                    specified_organism_id = None
                    if self.specified_organism.synonym and closest_distance > ORGANISM_DISTANCE_THRESHOLD:  # noqa
                        if fallback_gene_organism_matches.get(entity_synonym, None):
                            fallback_organisms_to_match: Dict[str, str] = {}

                            try:
                                # prioritize common name match over synonym
                                fallback_organisms_to_match = fallback_gene_organism_matches[entity_synonym][entity_synonym]  # noqa
                            except KeyError:
                                # only take the first gene for the organism
                                # no way for us to infer which to use
                                # logic moved from annotations_neo4j_service.py
                                for d in list(fallback_gene_organism_matches[entity_synonym].values()):  # noqa
                                    key = next(iter(d))
                                    if key not in fallback_organisms_to_match:
                                        fallback_organisms_to_match[key] = d[key]

                            # if matched in KG then set to fallback strain
                            gene_id = fallback_organisms_to_match[self.specified_organism.organism_id]  # noqa
                            specified_organism_id = self.specified_organism.organism_id

                    category = self.specified_organism.category if specified_organism_id else self.organism_categories[organism_id]  # noqa
                elif entity_synonym in fallback_gene_organism_matches:
                    try:
                        # prioritize common name match over synonym
                        organisms_to_match = fallback_gene_organism_matches[entity_synonym][entity_synonym]  # noqa
                    except KeyError:
                        # only take the first gene for the organism
                        # no way for us to infer which to use
                        # logic moved from annotations_neo4j_service.py
                        for d in list(fallback_gene_organism_matches[entity_synonym].values()):
                            key = next(iter(d))
                            if key not in organisms_to_match:
                                organisms_to_match[key] = d[key]
                    try:
                        gene_id = organisms_to_match[self.specified_organism.organism_id]  # noqa
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

    def _annotate_anatomy(
        self,
        entity_id_str: str,
        char_coord_objs_in_pdf: List[PDFChar],
        cropbox_in_pdf: Tuple[int, int],
    ) -> List[Annotation]:
        return self._get_annotation(
            tokens=self.matched_type_anatomy,
            token_type=EntityType.ANATOMY.value,
            color=EntityColor.ANATOMY.value,
            id_str=entity_id_str,
            char_coord_objs_in_pdf=char_coord_objs_in_pdf,
            cropbox_in_pdf=cropbox_in_pdf,
        )

    def _annotate_type_chemical(
        self,
        entity_id_str: str,
        char_coord_objs_in_pdf: List[PDFChar],
        cropbox_in_pdf: Tuple[int, int],
    ) -> List[Annotation]:
        return self._get_annotation(
            tokens=self.matched_type_chemical,
            token_type=EntityType.CHEMICAL.value,
            color=EntityColor.CHEMICAL.value,
            id_str=entity_id_str,
            char_coord_objs_in_pdf=char_coord_objs_in_pdf,
            cropbox_in_pdf=cropbox_in_pdf,
        )

    def _annotate_type_compound(
        self,
        entity_id_str: str,
        char_coord_objs_in_pdf: List[PDFChar],
        cropbox_in_pdf: Tuple[int, int],
    ) -> List[Annotation]:
        return self._get_annotation(
            tokens=self.matched_type_compound,
            token_type=EntityType.COMPOUND.value,
            color=EntityColor.COMPOUND.value,
            id_str=entity_id_str,
            char_coord_objs_in_pdf=char_coord_objs_in_pdf,
            cropbox_in_pdf=cropbox_in_pdf,
        )

    def _annotate_type_disease(
        self,
        entity_id_str: str,
        char_coord_objs_in_pdf: List[PDFChar],
        cropbox_in_pdf: Tuple[int, int],
    ) -> List[Annotation]:
        return self._get_annotation(
            tokens=self.matched_type_disease,
            token_type=EntityType.DISEASE.value,
            color=EntityColor.DISEASE.value,
            id_str=entity_id_str,
            char_coord_objs_in_pdf=char_coord_objs_in_pdf,
            cropbox_in_pdf=cropbox_in_pdf,
        )

    def _annotate_type_food(
        self,
        entity_id_str: str,
        char_coord_objs_in_pdf: List[PDFChar],
        cropbox_in_pdf: Tuple[int, int],
    ) -> List[Annotation]:
        return self._get_annotation(
            tokens=self.matched_type_food,
            token_type=EntityType.FOOD.value,
            color=EntityColor.FOOD.value,
            id_str=entity_id_str,
            char_coord_objs_in_pdf=char_coord_objs_in_pdf,
            cropbox_in_pdf=cropbox_in_pdf,
        )

    def _annotate_type_phenotype(
        self,
        entity_id_str: str,
        char_coord_objs_in_pdf: List[PDFChar],
        cropbox_in_pdf: Tuple[int, int],
    ) -> List[Annotation]:
        return self._get_annotation(
            tokens=self.matched_type_phenotype,
            token_type=EntityType.PHENOTYPE.value,
            color=EntityColor.PHENOTYPE.value,
            id_str=entity_id_str,
            char_coord_objs_in_pdf=char_coord_objs_in_pdf,
            cropbox_in_pdf=cropbox_in_pdf,
        )

    def _annotate_type_protein(
        self,
        entity_id_str: str,
        char_coord_objs_in_pdf: List[PDFChar],
        cropbox_in_pdf: Tuple[int, int],
    ) -> List[Annotation]:
        """Nearly identical to `self._annotate_type_gene`. Return a list of
        protein annotations with the correct protein_id. If the protein
        was not matched in the knowledge graph, then keep the original
        protein_id.
        """
        tokens: Dict[str, LMDBMatch] = self.matched_type_protein

        matches: List[Annotation] = []

        entity_tokenpos_pairs = []
        protein_names: Set[str] = set()
        for word, lmdb_match in tokens.items():
            for token_positions in lmdb_match.tokens:
                for entity in lmdb_match.entities:
                    protein_names.add(entity['synonym'])

                    entity_tokenpos_pairs.append((entity, token_positions))

        protein_names_list = list(protein_names)

        protein_organism_matches = \
            self.annotation_neo4j.get_proteins_to_organisms(
                proteins=protein_names_list,
                organisms=list(self.organism_frequency.keys()),
            )

        # any proteins not matched in KG fall back to specified organism
        fallback_protein_organism_matches = {}

        if self.specified_organism.synonym:
            fallback_protein_organism_matches = \
                self.annotation_neo4j.get_proteins_to_organisms(
                    proteins=protein_names_list,
                    organisms=[self.specified_organism.organism_id],
                )

        for entity, token_positions in entity_tokenpos_pairs:
            category = entity.get('category', '')
            try:
                protein_id = entity[EntityIdStr.PROTEIN.value]
                entity_synonym = entity['synonym']
            except KeyError:
                continue
            else:
                # TODO: code is identical to gene organism
                # move into function later if more than these two use
                if entity_synonym in protein_organism_matches:
                    protein_id, organism_id, closest_distance = self._get_closest_entity_organism_pair(  # noqa
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

    def _annotate_species(
        self,
        entity_id_str: str,
        char_coord_objs_in_pdf: List[PDFChar],
        cropbox_in_pdf: Tuple[int, int],
        word_index_dict: Dict[int, str]
    ) -> List[Annotation]:
        species_annotations = self._get_annotation(
            tokens=self.matched_type_species,
            token_type=EntityType.SPECIES.value,
            color=EntityColor.SPECIES.value,
            id_str=entity_id_str,
            char_coord_objs_in_pdf=char_coord_objs_in_pdf,
            cropbox_in_pdf=cropbox_in_pdf,
        )

        # clean species annotations first
        # because genes depend on them
        species_annotations = self._clean_annotations(
            annotations=species_annotations,
            char_coord_objs_in_pdf=char_coord_objs_in_pdf,
            word_index_dict=word_index_dict
        )

        self.organism_frequency, self.organism_locations, self.organism_categories = \
            self._get_entity_frequency_location_and_category(annotations=species_annotations)
        return species_annotations

    def _annotate_type_company(
        self,
        entity_id_str: str,
        char_coord_objs_in_pdf: List[Union[LTChar, LTAnno]],
        cropbox_in_pdf: Tuple[int, int],
    ) -> List[Annotation]:
        return self._get_annotation(
            tokens=self.matched_type_company,
            token_type=EntityType.COMPANY.value,
            color=EntityColor.COMPANY.value,
            id_str=entity_id_str,
            char_coord_objs_in_pdf=char_coord_objs_in_pdf,
            cropbox_in_pdf=cropbox_in_pdf,
        )

    def _annotate_type_entity(
        self,
        entity_id_str: str,
        char_coord_objs_in_pdf: List[Union[LTChar, LTAnno]],
        cropbox_in_pdf: Tuple[int, int],
    ) -> List[Annotation]:
        return self._get_annotation(
            tokens=self.matched_type_entity,
            token_type=EntityType.ENTITY.value,
            color=EntityColor.ENTITY.value,
            id_str=entity_id_str,
            char_coord_objs_in_pdf=char_coord_objs_in_pdf,
            cropbox_in_pdf=cropbox_in_pdf,
        )

    def annotate(
        self,
        annotation_type: str,
        entity_id_str: str,
        char_coord_objs_in_pdf: List[PDFChar],
        cropbox_in_pdf: Tuple[int, int],
        word_index_dict: Dict[int, str]
    ) -> List[Annotation]:
        funcs = {
            EntityType.ANATOMY.value: self._annotate_anatomy,
            EntityType.CHEMICAL.value: self._annotate_type_chemical,
            EntityType.COMPOUND.value: self._annotate_type_compound,
            EntityType.DISEASE.value: self._annotate_type_disease,
            EntityType.FOOD.value: self._annotate_type_food,
            EntityType.PHENOTYPE.value: self._annotate_type_phenotype,
            EntityType.SPECIES.value: self._annotate_species,
            EntityType.PROTEIN.value: self._annotate_type_protein,
            EntityType.GENE.value: self._annotate_type_gene,
            EntityType.COMPANY.value: self._annotate_type_company,
            EntityType.ENTITY.value: self._annotate_type_entity
        }

        annotate_entities = funcs[annotation_type]
        if annotation_type == EntityType.SPECIES.value:
            return annotate_entities(
                entity_id_str=entity_id_str,
                char_coord_objs_in_pdf=char_coord_objs_in_pdf,
                cropbox_in_pdf=cropbox_in_pdf,
                word_index_dict=word_index_dict
            )  # type: ignore
        else:
            return annotate_entities(
                entity_id_str=entity_id_str,
                char_coord_objs_in_pdf=char_coord_objs_in_pdf,
                cropbox_in_pdf=cropbox_in_pdf
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
        gene 'marA' is correct, but 'mara' is not.
        """
        def is_abbrev(text_in_document, annotation, word_index_list, abbrevs) -> bool:
            """Determine if a word is an abbreviation. If wrapped inside parenthesis,
            look at x previous words. Start from closest word to abbreviation, and
            check the first character.
            """
            if text_in_document not in abbrevs:
                if all([c.isupper() for c in text_in_document]) and \
                    len(text_in_document) in ABBREVIATION_WORD_LENGTH:  # noqa
                    try:
                        begin = char_coord_objs_in_pdf[annotation.lo_location_offset - 1].text  # noqa
                        end = char_coord_objs_in_pdf[annotation.hi_location_offset + 1].text  # noqa
                    except IndexError:
                        # if index out of range than
                        # character is beginning/end of paper
                        return False
                    if begin == '(' and end == ')':
                        i = bisect_left(word_index_list, annotation.lo_location_offset)
                        abbrev = ''

                        for idx in reversed(word_index_list[i-len(text_in_document):i]):
                            word = word_index_dict[idx]
                            if '-' in word or '/' in word:
                                word_split = []
                                if '-' in word:
                                    word_split = word.split('-')
                                elif '/' in word:
                                    word_split = word.split('/')

                                for split in reversed(word_split):
                                    if len(abbrev) == len(text_in_document):
                                        break
                                    else:
                                        abbrev = split[0] + abbrev
                                if len(abbrev) == len(text_in_document):
                                    break
                            else:
                                abbrev = word[0] + abbrev
                        if abbrev.lower() != text_in_document.lower():
                            return False
                        else:
                            # is an abbreviation so mark it as so
                            return True
                    else:
                        return False
                else:
                    return False
            else:
                return True

        fixed_annotations: List[Annotation] = []
        word_index_list = list(word_index_dict)

        abbrevs: Set[str] = set()

        for annotation in annotations_list:
            text_in_document = annotation.text_in_document.split(' ')

            # TODO: Does the order of these checks matter?

            if isinstance(annotation, GeneAnnotation) or \
            (annotation.meta.type == EntityType.PROTEIN.value and len(text_in_document) == 1):  # noqa
                text_in_document = text_in_document[0]  # type: ignore
                if text_in_document == annotation.keyword:
                    if is_abbrev(text_in_document, annotation, word_index_list, abbrevs):
                        abbrevs.add(text_in_document)  # type: ignore
                    else:
                        fixed_annotations.append(annotation)
            elif len(text_in_document) > 1:
                keyword_from_annotation = annotation.keyword.split(' ')
                if len(keyword_from_annotation) >= len(text_in_document):
                    fixed_annotations.append(annotation)
                else:
                    # consider case such as `ferredoxin 2` vs `ferredoxin-2` in lmdb
                    keyword_from_annotation = annotation.keyword.split('-')
                    if len(keyword_from_annotation) >= len(text_in_document):
                        fixed_annotations.append(annotation)
            else:
                text_in_document = text_in_document[0]  # type: ignore
                if is_abbrev(text_in_document, annotation, word_index_list, abbrevs):
                    abbrevs.add(text_in_document)  # type: ignore
                else:
                    fixed_annotations.append(annotation)

        return fixed_annotations

    def _create_annotations(
        self,
        char_coord_objs_in_pdf: List[PDFChar],
        cropbox_in_pdf: Tuple[int, int],
        types_to_annotate: List[Tuple[str, str]],
        word_index_dict: Dict[int, str]
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
                word_index_dict=word_index_dict
            )
            unified_annotations.extend(annotations)

        return unified_annotations

    def create_rules_based_annotations(
        self,
        tokens: PDFTokenPositionsList,
        entity_results: EntityResults,
        entity_type_and_id_pairs: List[Tuple[str, str]],
        specified_organism: SpecifiedOrganismStrain,
    ) -> List[Annotation]:
        """Create annotations based on semantic rules."""
        self.matched_type_anatomy = entity_results.matched_type_anatomy
        self.matched_type_chemical = entity_results.matched_type_chemical
        self.matched_type_compound = entity_results.matched_type_compound
        self.matched_type_disease = entity_results.matched_type_disease
        self.matched_type_food = entity_results.matched_type_food
        self.matched_type_gene = entity_results.matched_type_gene
        self.matched_type_phenotype = entity_results.matched_type_phenotype
        self.matched_type_protein = entity_results.matched_type_protein
        self.matched_type_species = entity_results.matched_type_species
        self.matched_type_company = entity_results.matched_type_company
        self.matched_type_entity = entity_results.matched_type_entity

        self.specified_organism = specified_organism

        annotations = self._create_annotations(
            char_coord_objs_in_pdf=tokens.char_coord_objs_in_pdf,
            cropbox_in_pdf=tokens.cropbox_in_pdf,
            types_to_annotate=entity_type_and_id_pairs,
            word_index_dict=tokens.word_index_dict
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
            word_index_dict=word_index_dict
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
        is_case_insensitive: bool,
        tokens: PDFTokenPositionsList
    ):
        """Returns coordinate positions and page numbers
        for all matching terms in the document
        """
        matches = []
        for token in tokens.token_positions:
            if not is_case_insensitive:
                if token.keyword != keyword:
                    continue
            elif standardize_str(token.keyword).lower() != standardize_str(keyword).lower():
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
