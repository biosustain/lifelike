import time

from math import inf, isinf
from typing import cast, Dict, List, Set, Tuple, Union
from uuid import uuid4

from flask import current_app
from pdfminer.layout import LTAnno, LTChar

from neo4japp.services.annotations import (
    AnnotationDBService,
    AnnotationGraphService,
    AnnotationInterval,
    AnnotationIntervalTree
)
from neo4japp.services.annotations.constants import (
    DatabaseType,
    EntityIdStr,
    EntityType,
    OrganismCategory,
    ENTITY_HYPERLINKS,
    ENTITY_TYPE_PRECEDENCE,
    HOMO_SAPIENS_TAX_ID,
    ORGANISM_DISTANCE_THRESHOLD,
    SEARCH_LINKS,
)
from neo4japp.services.annotations.util import has_center_point
from neo4japp.services.annotations.data_transfer_objects import (
    Annotation,
    EntityResults,
    GeneAnnotation,
    LMDBMatch,
    OrganismAnnotation,
    PDFWord,
    SpecifiedOrganismStrain
)
from neo4japp.exceptions import AnnotationError
from neo4japp.util import normalize_str, standardize_str
from neo4japp.utils.logger import EventLog


class AnnotationService:
    def __init__(
        self,
        db: AnnotationDBService,
        graph: AnnotationGraphService,
    ) -> None:
        self.db = db
        self.graph = graph

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
        phenomena: bool = True,
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

        if phenomena:
            entity_type_and_id_pairs.append(
                (EntityType.PHENOMENA.value, EntityIdStr.PHENOMENA.value))

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

    def _create_annotation_object(
        self,
        token: PDFWord,
        token_type: str,
        entity: dict,
        entity_id: str,
        entity_id_type: str,
        entity_category: str,
        entity_id_hyperlink: str
    ) -> Annotation:
        keyword_starting_idx = token.lo_location_offset
        keyword_ending_idx = token.hi_location_offset
        link_search_term = token.keyword

        # entity here is data structure from LMDB
        # see services/annotations/util.py for definition
        if not entity_id_hyperlink:
            if entity['id_type'] != DatabaseType.NCBI.value:
                hyperlink = ENTITY_HYPERLINKS[entity['id_type']]
            else:
                # type ignore, see https://github.com/python/mypy/issues/8277
                hyperlink = ENTITY_HYPERLINKS[entity['id_type']][token_type]  # type: ignore

            if entity['id_type'] == DatabaseType.MESH.value and DatabaseType.MESH.value in entity_id:  # noqa
                hyperlink += entity_id[5:]  # type: ignore
            else:
                hyperlink += entity_id  # type: ignore
        else:
            hyperlink = entity_id_hyperlink

        id_type = entity_id_type or entity['id_type']
        synonym = entity['synonym']
        primary_name = entity['name']

        if token_type == EntityType.SPECIES.value:
            organism_meta = OrganismAnnotation.OrganismMeta(
                category=entity_category,
                type=token_type,
                id=entity_id,
                id_type=id_type,
                id_hyperlink=cast(str, hyperlink),
                links=OrganismAnnotation.OrganismMeta.Links(
                    **{domain: url + link_search_term for domain, url in SEARCH_LINKS.items()}
                ),
                all_text=synonym,
            )
            # the `keywords` property here is to allow us to know
            # what coordinates map to what text in the PDF
            # we want to actually use the real name inside LMDB
            # for the `keyword` property
            annotation = OrganismAnnotation(
                page_number=token.page_number,
                rects=token.coordinates,
                keywords=[token.keyword],
                keyword=synonym,
                primary_name=primary_name,
                text_in_document=token.keyword,
                keyword_length=len(token.keyword),
                lo_location_offset=keyword_starting_idx,
                hi_location_offset=keyword_ending_idx,
                meta=organism_meta,
                uuid=str(uuid4()),
            )
        elif token_type == EntityType.GENE.value:
            gene_meta = GeneAnnotation.GeneMeta(
                category=entity_category,
                type=token_type,
                id=entity_id,
                id_type=id_type,
                id_hyperlink=cast(str, hyperlink),
                links=GeneAnnotation.GeneMeta.Links(
                    **{domain: url + link_search_term for domain, url in SEARCH_LINKS.items()}
                ),
                all_text=synonym,
            )
            annotation = GeneAnnotation(
                page_number=token.page_number,
                rects=token.coordinates,
                keywords=[token.keyword],
                keyword=synonym,
                primary_name=primary_name,
                text_in_document=token.keyword,
                keyword_length=len(token.keyword),
                lo_location_offset=keyword_starting_idx,
                hi_location_offset=keyword_ending_idx,
                meta=gene_meta,
                uuid=str(uuid4()),
            )  # type: ignore
        else:
            meta = Annotation.Meta(
                type=token_type,
                id=entity_id,
                id_type=id_type,
                id_hyperlink=cast(str, hyperlink),
                links=Annotation.Meta.Links(
                    **{domain: url + link_search_term for domain, url in SEARCH_LINKS.items()}
                ),
                all_text=synonym,
            )
            annotation = Annotation(
                page_number=token.page_number,
                rects=token.coordinates,
                keywords=[token.keyword],
                keyword=synonym,
                primary_name=primary_name,
                text_in_document=token.keyword,
                keyword_length=len(token.keyword),
                lo_location_offset=keyword_starting_idx,
                hi_location_offset=keyword_ending_idx,
                meta=meta,
                uuid=str(uuid4()),
            )  # type: ignore
        return annotation

    def _get_annotation(
        self,
        matches_list: List[LMDBMatch],
        token_type: str,
        id_str: str,
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
        tokens_lowercased = set(match.token.normalized_keyword for match in matches_list)  # noqa
        synonym_common_names_dict: Dict[str, Set[str]] = {}

        for match in matches_list:
            for entity in match.entities:
                entity_synonym = entity['synonym']
                entity_common_name = entity['name']
                if entity_synonym in synonym_common_names_dict:
                    synonym_common_names_dict[entity_synonym].add(normalize_str(entity_common_name))  # noqa
                else:
                    synonym_common_names_dict[entity_synonym] = {normalize_str(entity_common_name)}  # noqa

            for entity in match.entities:
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
                        token=match.token,
                        token_type=token_type,
                        entity=entity,
                        entity_id=entity[id_str],
                        entity_id_type=match.id_type,
                        entity_id_hyperlink=match.id_hyperlink,
                        entity_category=entity.get('category', '')
                    )
                except KeyError:
                    continue
                else:
                    matches.append(annotation)
        return matches

    def _get_closest_entity_organism_pair(
        self,
        entity: PDFWord,
        organism_matches: Dict[str, str],
        above_only: bool = False
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
        entity_location_lo = entity.lo_location_offset
        entity_location_hi = entity.hi_location_offset

        closest_dist = inf
        curr_closest_organism = None

        for organism in organism_matches:
            if curr_closest_organism is None:
                curr_closest_organism = organism

            min_organism_dist = inf
            new_organism_dist = inf

            organism_locations = []

            try:
                organism_locations = self.organism_locations[organism]
            except KeyError:
                current_app.logger.error(
                    f'Organism ID {organism} does not exist in {self.organism_locations}.',
                    extra=EventLog(event_type='annotations').to_dict()
                )
                continue

            # Get the closest instance of this organism
            for organism_pos in organism_locations:
                organism_location_lo = organism_pos[0]
                organism_location_hi = organism_pos[1]

                if entity_location_lo > organism_location_hi:
                    # organism is before entity
                    new_organism_dist = entity_location_lo - organism_location_hi
                else:
                    if not above_only:
                        new_organism_dist = organism_location_lo - entity_location_hi

                if new_organism_dist < min_organism_dist:
                    min_organism_dist = new_organism_dist

            # If this organism is closer than the current closest, update
            if min_organism_dist < closest_dist:
                curr_closest_organism = organism
                closest_dist = min_organism_dist
            # If this organism is equidistant to the current closest, check frequency instead
            elif min_organism_dist == closest_dist:
                try:
                    # If the frequency of this organism is greater, update
                    if self.organism_frequency[organism] > self.organism_frequency[curr_closest_organism]:  # noqa
                        curr_closest_organism = organism
                    elif self.organism_frequency[organism] == self.organism_frequency[curr_closest_organism]:  # noqa
                        # If the organisms are equidistant and equal frequency,
                        # check if the new organism is human, and if so update
                        if organism == HOMO_SAPIENS_TAX_ID:
                            curr_closest_organism = organism
                except KeyError:
                    curr_closest_organism = organism

        if curr_closest_organism is None:
            raise AnnotationError(
                title='Unable to Annotate',
                message='Cannot get gene ID with no organisms.')

        # Return the gene id of the organism with the highest priority
        return organism_matches[curr_closest_organism], curr_closest_organism, closest_dist

    def _annotate_type_gene(
        self,
        entity_id_str: str,
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
        matches_list: List[LMDBMatch] = self.matched_type_gene

        matches: List[Annotation] = []

        entity_token_pairs = []
        gene_names: Set[str] = set()

        for match in matches_list:
            for entity in match.entities:
                entity_synonym = entity['name'] if entity.get('inclusion', None) else entity['synonym']  # noqa
                gene_names.add(entity_synonym)
                entity_token_pairs.append(
                    (entity, match.id_type, match.id_hyperlink, match.token))

        gene_names_list = list(gene_names)
        organism_ids = list(self.organism_frequency.keys())
        gene_organism_matches = {}

        if not self.enrichment_mappings:
            gene_match_time = time.time()
            gene_organism_matches = self.graph.get_gene_to_organism_match_result(
                genes=gene_names_list,
                postgres_genes=self.db.get_genes(
                    genes=gene_names_list, organism_ids=organism_ids),
                matched_organism_ids=organism_ids,
            )
            current_app.logger.info(
                f'Gene organism KG query time {time.time() - gene_match_time}',
                extra=EventLog(event_type='annotations').to_dict()
            )

        # any genes not matched in KG fall back to specified organism
        fallback_gene_organism_matches = {}

        if self.specified_organism.synonym:
            gene_match_time = time.time()
            fallback_gene_organism_matches = \
                self.graph.get_gene_to_organism_match_result(
                    genes=gene_names_list,
                    postgres_genes=self.db.get_genes(
                        genes=gene_names_list, organism_ids=organism_ids),
                    matched_organism_ids=[self.specified_organism.organism_id],
                )
            current_app.logger.info(
                f'Gene fallback organism KG query time {time.time() - gene_match_time}',
                extra=EventLog(event_type='annotations').to_dict()
            )

        for entity, entity_id_type, entity_id_hyperlink, token in entity_token_pairs:
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
                        # logic moved from annotation_graph_service.py
                        for d in list(gene_organism_matches[entity_synonym].values()):
                            key = next(iter(d))
                            if key not in organisms_to_match:
                                organisms_to_match[key] = d[key]

                    gene_id, organism_id, closest_distance = self._get_closest_entity_organism_pair(
                        entity=token,
                        organism_matches=organisms_to_match
                    )

                    specified_organism_id = None
                    if closest_distance > ORGANISM_DISTANCE_THRESHOLD:
                        has_fallback_match = fallback_gene_organism_matches.get(entity_synonym, False)  # noqa

                        if self.specified_organism.synonym and has_fallback_match:
                            fallback_organisms_to_match: Dict[str, str] = {}

                            try:
                                # prioritize common name match over synonym
                                fallback_organisms_to_match = fallback_gene_organism_matches[entity_synonym][entity_synonym]  # noqa
                            except KeyError:
                                # only take the first gene for the organism
                                # no way for us to infer which to use
                                # logic moved from annotation_graph_service.py
                                for d in list(fallback_gene_organism_matches[entity_synonym].values()):  # noqa
                                    key = next(iter(d))
                                    if key not in fallback_organisms_to_match:
                                        fallback_organisms_to_match[key] = d[key]

                            # if matched in KG then set to fallback strain
                            if fallback_organisms_to_match.get(self.specified_organism.organism_id, None):  # noqa
                                gene_id = fallback_organisms_to_match[self.specified_organism.organism_id]  # noqa
                                specified_organism_id = self.specified_organism.organism_id
                        else:
                            # try to get organism above
                            gene_id, organism_id, closest_distance = self._get_closest_entity_organism_pair(  # noqa
                                entity=token,
                                organism_matches=organisms_to_match,
                                above_only=True
                            )
                            if isinf(closest_distance):
                                continue

                    category = self.specified_organism.category if specified_organism_id else self.organism_categories[organism_id]  # noqa
                elif entity_synonym in fallback_gene_organism_matches:
                    try:
                        # prioritize common name match over synonym
                        organisms_to_match = fallback_gene_organism_matches[entity_synonym][entity_synonym]  # noqa
                    except KeyError:
                        # only take the first gene for the organism
                        # no way for us to infer which to use
                        # logic moved from annotation_graph_service.py
                        for d in list(fallback_gene_organism_matches[entity_synonym].values()):
                            key = next(iter(d))
                            if key not in organisms_to_match:
                                organisms_to_match[key] = d[key]
                    try:
                        gene_id = organisms_to_match[self.specified_organism.organism_id]  # noqa
                        category = self.specified_organism.category
                    except KeyError:
                        continue

                if gene_id and category:
                    annotation = self._create_annotation_object(
                        token=token,
                        token_type=EntityType.GENE.value,
                        entity=entity,
                        entity_id=gene_id,
                        entity_id_type=entity_id_type,
                        entity_id_hyperlink=entity_id_hyperlink,
                        entity_category=category
                    )
                    matches.append(annotation)
        return matches

    def _annotate_anatomy(
        self,
        entity_id_str: str
    ) -> List[Annotation]:
        return self._get_annotation(
            matches_list=self.matched_type_anatomy,
            token_type=EntityType.ANATOMY.value,
            id_str=entity_id_str
        )

    def _annotate_type_chemical(
        self,
        entity_id_str: str
    ) -> List[Annotation]:
        return self._get_annotation(
            matches_list=self.matched_type_chemical,
            token_type=EntityType.CHEMICAL.value,
            id_str=entity_id_str
        )

    def _annotate_type_compound(
        self,
        entity_id_str: str
    ) -> List[Annotation]:
        return self._get_annotation(
            matches_list=self.matched_type_compound,
            token_type=EntityType.COMPOUND.value,
            id_str=entity_id_str
        )

    def _annotate_type_disease(
        self,
        entity_id_str: str
    ) -> List[Annotation]:
        return self._get_annotation(
            matches_list=self.matched_type_disease,
            token_type=EntityType.DISEASE.value,
            id_str=entity_id_str
        )

    def _annotate_type_food(
        self,
        entity_id_str: str
    ) -> List[Annotation]:
        return self._get_annotation(
            matches_list=self.matched_type_food,
            token_type=EntityType.FOOD.value,
            id_str=entity_id_str
        )

    def _annotate_type_phenotype(
        self,
        entity_id_str: str
    ) -> List[Annotation]:
        return self._get_annotation(
            matches_list=self.matched_type_phenotype,
            token_type=EntityType.PHENOTYPE.value,
            id_str=entity_id_str
        )

    def _annotate_type_phenomena(
        self,
        entity_id_str: str
    ) -> List[Annotation]:
        return self._get_annotation(
            matches_list=self.matched_type_phenomena,
            token_type=EntityType.PHENOMENA.value,
            id_str=entity_id_str
        )

    def _annotate_type_protein(
        self,
        entity_id_str: str
    ) -> List[Annotation]:
        """Nearly identical to `self._annotate_type_gene`. Return a list of
        protein annotations with the correct protein_id. If the protein
        was not matched in the knowledge graph, then keep the original
        protein_id.
        """
        matches_list: List[LMDBMatch] = self.matched_type_protein

        matches: List[Annotation] = []

        entity_token_pairs = []
        protein_names: Set[str] = set()
        for match in matches_list:
            for entity in match.entities:
                entity_synonym = entity['synonym']
                protein_names.add(entity_synonym)
                entity_token_pairs.append(
                    (entity, match.id_type, match.id_hyperlink, match.token))

        protein_names_list = list(protein_names)
        protein_organism_matches = {}

        if not self.enrichment_mappings:
            protein_match_time = time.time()
            protein_organism_matches = self.graph.get_proteins_to_organisms(
                proteins=protein_names_list,
                organisms=list(self.organism_frequency.keys()),
            )
            current_app.logger.info(
                f'Protein organism KG query time {time.time() - protein_match_time}',
                extra=EventLog(event_type='annotations').to_dict()
            )

        # any proteins not matched in KG fall back to specified organism
        fallback_protein_organism_matches = {}

        if self.specified_organism.synonym:
            protein_match_time = time.time()
            fallback_protein_organism_matches = \
                self.graph.get_proteins_to_organisms(
                    proteins=protein_names_list,
                    organisms=[self.specified_organism.organism_id],
                )
            current_app.logger.info(
                f'Protein fallback organism KG query time {time.time() - protein_match_time}',
                extra=EventLog(event_type='annotations').to_dict()
            )

        for entity, entity_id_type, entity_id_hyperlink, token in entity_token_pairs:
            category = entity.get('category', '')
            try:
                protein_id = entity[EntityIdStr.PROTEIN.value]
                entity_synonym = entity['synonym']
            except KeyError:
                continue
            else:
                if entity_synonym in protein_organism_matches:
                    protein_id, organism_id, closest_distance = self._get_closest_entity_organism_pair(  # noqa
                        entity=token,
                        organism_matches=protein_organism_matches[entity_synonym]
                    )

                    specified_organism_id = None
                    if closest_distance > ORGANISM_DISTANCE_THRESHOLD:
                        has_fallback_match = fallback_protein_organism_matches.get(entity_synonym, False)  # noqa

                        if self.specified_organism.synonym and has_fallback_match:
                            # if matched in KG then set to fallback strain
                            protein_id = fallback_protein_organism_matches[entity_synonym][self.specified_organism.organism_id]  # noqa
                            specified_organism_id = self.specified_organism.organism_id
                        else:
                            # try to get organism above
                            protein_id, organism_id, closest_distance = self._get_closest_entity_organism_pair(  # noqa
                                entity=token,
                                organism_matches=protein_organism_matches[entity_synonym],
                                above_only=True
                            )
                            if isinf(closest_distance):
                                continue

                    category = self.specified_organism.category if specified_organism_id else self.organism_categories[organism_id]  # noqa
                elif entity_synonym in fallback_protein_organism_matches:
                    try:
                        protein_id = fallback_protein_organism_matches[entity_synonym][self.specified_organism.organism_id]  # noqa
                        category = self.specified_organism.category
                    except KeyError:
                        continue

                annotation = self._create_annotation_object(
                    token=token,
                    token_type=EntityType.PROTEIN.value,
                    entity=entity,
                    entity_id=protein_id,
                    entity_id_type=entity_id_type,
                    entity_id_hyperlink=entity_id_hyperlink,
                    entity_category=category
                )
                matches.append(annotation)
        return matches

    def _annotate_type_species_local(self) -> List[Annotation]:
        """Similar to self._get_annotation() but for creating
        annotations of custom species.
        However, does not check if a synonym is used by multiple
        common names that all appear in the document, as assume
        user wants these custom species annotations to be
        annotated.
        """
        matches = self.matched_type_species_local

        custom_annotations: List[Annotation] = []

        for match in matches:
            for entity in match.entities:
                try:
                    annotation = self._create_annotation_object(
                        token=match.token,
                        token_type=EntityType.SPECIES.value,
                        entity=entity,
                        entity_id=entity[EntityIdStr.SPECIES.value],
                        entity_id_type=match.id_type,
                        entity_id_hyperlink=match.id_hyperlink,
                        entity_category=entity.get('category', '')
                    )
                except KeyError:
                    continue
                else:
                    custom_annotations.append(annotation)
        return custom_annotations

    def _annotate_type_species(
        self,
        entity_id_str: str,
        custom_annotations: List[dict],
        excluded_annotations: List[dict]
    ) -> List[Annotation]:
        species_annotations = self._get_annotation(
            matches_list=self.matched_type_species,
            token_type=EntityType.SPECIES.value,
            id_str=entity_id_str
        )

        species_annotations_local = self._annotate_type_species_local()

        inclusion_type_species_local = [
            custom for custom in custom_annotations if custom.get(
                'meta', {}).get('type') == EntityType.SPECIES.value and not custom.get(
                    'meta', {}).get('includeGlobally')]

        exclusion_type_species_local = [
            exclude for exclude in excluded_annotations if exclude.get(
                'type') == EntityType.SPECIES.value and not exclude.get(
                    'excludeGlobally')]

        # we only want the annotations with correct coordinates
        # because it is possible for a word to only have one
        # of its occurrences annotated as a custom annotation
        filtered_species_annotations_local: List[Annotation] = []

        for custom in inclusion_type_species_local:
            for custom_anno in species_annotations_local:
                if custom.get('rects') and len(custom['rects']) == len(custom_anno.rects):
                    # check if center point for each rect in custom_anno.rects
                    # is in the corresponding rectangle from custom annotations
                    valid = all(list(map(has_center_point, custom['rects'], custom_anno.rects)))

                    # if center point is in custom annotation rectangle
                    # then add it to list
                    if valid:
                        filtered_species_annotations_local.append(custom_anno)

        # clean species annotations first
        # because genes depend on them
        species_annotations = self._get_fixed_false_positive_unified_annotations(
            annotations_list=species_annotations
        )

        # we only want the annotations with correct coordinates
        # because it is possible for a word to only have one
        # of its occurrences annotated as a custom annotation
        exclusions_to_remove: Set[str] = set()

        for custom in exclusion_type_species_local:
            for anno in species_annotations:
                if custom.get('rects') and len(custom['rects']) == len(anno.rects):
                    # check if center point for each rect in anno.rects
                    # is in the corresponding rectangle from custom annotations
                    valid = all(list(map(has_center_point, custom['rects'], anno.rects)))

                    # if center point is in custom annotation rectangle
                    # then remove it from list
                    if valid:
                        exclusions_to_remove.add(anno.uuid)

        filtered_species_annotations_of_exclusions = [
            anno for anno in species_annotations if anno.uuid not in exclusions_to_remove]

        filtered_species_annotations: List[Annotation] = []

        if inclusion_type_species_local:
            filtered_species_annotations += filtered_species_annotations_local

        if exclusion_type_species_local:
            filtered_species_annotations += filtered_species_annotations_of_exclusions
        else:
            filtered_species_annotations += species_annotations

        self.organism_frequency, self.organism_locations, self.organism_categories = \
            self._get_entity_frequency_location_and_category(
                annotations=filtered_species_annotations)

        return species_annotations

    def _annotate_type_company(self, entity_id_str: str) -> List[Annotation]:
        return self._get_annotation(
            matches_list=self.matched_type_company,
            token_type=EntityType.COMPANY.value,
            id_str=entity_id_str
        )

    def _annotate_type_entity(
        self,
        entity_id_str: str
    ) -> List[Annotation]:
        return self._get_annotation(
            matches_list=self.matched_type_entity,
            token_type=EntityType.ENTITY.value,
            id_str=entity_id_str
        )

    def _update_entity_frequency_map(
        self,
        entity_frequency: Dict[str, int],
        annotation
    ) -> Dict[str, int]:
        entity_id = annotation.meta.id
        if entity_frequency.get(entity_id, None) is not None:
            entity_frequency[entity_id] += 1
        else:
            entity_frequency[entity_id] = 1

        # If this annotation is a virus then we also have to update the homo sapiens frequency
        if annotation.meta.category == OrganismCategory.VIRUSES.value:  # noqa
            if entity_frequency.get(HOMO_SAPIENS_TAX_ID, None) is not None:
                entity_frequency[HOMO_SAPIENS_TAX_ID] += 1
            else:
                entity_frequency[HOMO_SAPIENS_TAX_ID] = 1

        return entity_frequency

    def _update_entity_location_map(
        self,
        matched_entity_locations: Dict[str, List[Tuple[int, int]]],
        annotation
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
        if not self.enrichment_mappings and annotation.meta.category == OrganismCategory.VIRUSES.value:  # noqa
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
        annotations
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
            entity_categories[annotation.meta.id] = annotation.meta.category or ''

            # Need to add an entry for humans if we annotated a virus
            if not self.enrichment_mappings and annotation.meta.category == OrganismCategory.VIRUSES.value:  # noqa
                entity_categories[HOMO_SAPIENS_TAX_ID] = OrganismCategory.EUKARYOTA.value

        return entity_frequency, matched_entity_locations, entity_categories

    def _get_fixed_false_positive_unified_annotations(
        self,
        annotations_list: List[Annotation]
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
        fixed_annotations: List[Annotation] = []

        for annotation in annotations_list:
            text_in_document = annotation.text_in_document.split(' ')

            # TODO: Does the order of these checks matter?

            if isinstance(annotation, GeneAnnotation) or \
            (annotation.meta.type == EntityType.PROTEIN.value and len(text_in_document) == 1):  # noqa
                text_in_document = text_in_document[0]  # type: ignore
                if text_in_document == annotation.keyword:
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
                fixed_annotations.append(annotation)

        return fixed_annotations

    def _create_annotations(
        self,
        types_to_annotate: List[Tuple[str, str]],
        custom_annotations: List[dict],
        excluded_annotations: List[dict]
    ) -> List[Annotation]:
        """Create annotations.

        Args:
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

        funcs = {
            EntityType.ANATOMY.value: self._annotate_anatomy,
            EntityType.CHEMICAL.value: self._annotate_type_chemical,
            EntityType.COMPOUND.value: self._annotate_type_compound,
            EntityType.DISEASE.value: self._annotate_type_disease,
            EntityType.FOOD.value: self._annotate_type_food,
            EntityType.PHENOMENA.value: self._annotate_type_phenomena,
            EntityType.PHENOTYPE.value: self._annotate_type_phenotype,
            EntityType.SPECIES.value: self._annotate_type_species,
            EntityType.PROTEIN.value: self._annotate_type_protein,
            EntityType.GENE.value: self._annotate_type_gene,
            EntityType.COMPANY.value: self._annotate_type_company,
            EntityType.ENTITY.value: self._annotate_type_entity
        }

        for entity_type, entity_id_str in types_to_annotate:
            annotate_entities = funcs[entity_type]
            if entity_type == EntityType.SPECIES.value:
                annotations = annotate_entities(
                    entity_id_str=entity_id_str,
                    custom_annotations=custom_annotations,
                    excluded_annotations=excluded_annotations
                )  # type: ignore
                unified_annotations.extend(annotations)
            else:
                annotations = annotate_entities(entity_id_str=entity_id_str)  # type: ignore
                unified_annotations.extend(annotations)

        return unified_annotations

    def create_annotations(
        self,
        custom_annotations: List[dict],
        excluded_annotations: List[dict],
        entity_results: EntityResults,
        entity_type_and_id_pairs: List[Tuple[str, str]],
        specified_organism: SpecifiedOrganismStrain,
        enrichment_mappings: Dict[int, dict] = None
    ) -> List[Annotation]:
        self.matched_type_anatomy = entity_results.matched_type_anatomy
        self.matched_type_chemical = entity_results.matched_type_chemical
        self.matched_type_compound = entity_results.matched_type_compound
        self.matched_type_disease = entity_results.matched_type_disease
        self.matched_type_food = entity_results.matched_type_food
        self.matched_type_gene = entity_results.matched_type_gene
        self.matched_type_phenomena = entity_results.matched_type_phenomena
        self.matched_type_phenotype = entity_results.matched_type_phenotype
        self.matched_type_protein = entity_results.matched_type_protein
        self.matched_type_species = entity_results.matched_type_species
        self.matched_type_species_local = entity_results.matched_type_species_local
        self.matched_type_company = entity_results.matched_type_company
        self.matched_type_entity = entity_results.matched_type_entity

        self.specified_organism = specified_organism
        self.enrichment_mappings = enrichment_mappings

        annotations = self._create_annotations(
            types_to_annotate=entity_type_and_id_pairs,
            custom_annotations=custom_annotations,
            excluded_annotations=excluded_annotations
        )

        cleaned = self._clean_annotations(
            annotations=annotations,
            enrichment_mappings=self.enrichment_mappings)
        # update the annotations with the common primary name
        # do this after cleaning because it's easier to
        # query the KG for the primary names after the
        # duplicates/overlapping intervals are removed
        return self.add_primary_name(annotations=cleaned)

    def _clean_annotations(
        self,
        annotations: List[Annotation],
        enrichment_mappings: Dict[int, dict] = None
    ) -> List[Annotation]:
        fixed_unified_annotations = self._get_fixed_false_positive_unified_annotations(
            annotations_list=annotations)

        if enrichment_mappings:
            # need to split up the annotations otherwise
            # a text in a cell could be removed due to
            # overlapping with an adjacent cell
            split: Dict[int, List[Annotation]] = {}
            for k in enrichment_mappings:
                # append annotation to list that is greater
                # than hi_location_offset
                # this means the annotation is part of that sublist
                split[k] = [anno for anno in fixed_unified_annotations if anno.hi_location_offset <= k]  # noqa

            combined: List[Annotation] = []
            for _, v in split.items():
                combined += self.fix_conflicting_annotations(
                    unified_annotations=v)

            fixed_unified_annotations = combined
        else:
            fixed_unified_annotations = self.fix_conflicting_annotations(
                unified_annotations=fixed_unified_annotations)
        return fixed_unified_annotations

    def add_primary_name(self, annotations: List[Annotation]) -> List[Annotation]:
        """Apply the primary name to the annotations based on the returned data
        from the knowledge graph. Also update the annotation id to have the source
        database prefix.
        """
        gene_ids = set()
        protein_ids = set()

        for anno in annotations:
            if anno.meta.type == EntityType.GENE.value:
                gene_ids.add(anno.meta.id)
            elif anno.meta.type == EntityType.PROTEIN.value:
                protein_ids.add(anno.meta.id)

        gene_names = self.graph.get_genes_from_gene_ids(list(gene_ids))
        protein_names = self.graph.get_proteins_from_protein_ids(list(protein_ids))

        for anno in annotations:
            try:
                if anno.meta.type == EntityType.GENE.value:
                    anno.primary_name = gene_names[anno.meta.id]
                elif anno.meta.type == EntityType.PROTEIN.value:
                    anno.primary_name = protein_names[anno.meta.id]
            except KeyError:
                # just keep what is already there or use the
                # synonym if blank
                if not anno.primary_name:
                    anno.primary_name = anno.keyword
            finally:
                if anno.meta.id_type not in anno.meta.id:
                    # update annotation id
                    anno.meta.id = f'{anno.meta.id_type}:{anno.meta.id}'
        return annotations

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
        annotation_interval_set: Set[Tuple[int, int]] = set()

        for unified in unified_annotations:
            interval_pair = (unified.lo_location_offset, unified.hi_location_offset)
            if interval_pair in annotation_interval_dict:
                annotation_interval_dict[interval_pair].append(unified)
            else:
                annotation_interval_dict[interval_pair] = [unified]
            annotation_interval_set.add(interval_pair)

        # it's faster to create an interval tree with just
        # intervals, rather than a tree with intervals and data
        # because the data are viewed as unique, so the tree is bigger
        tree = AnnotationIntervalTree(
            AnnotationInterval(
                begin=lo,
                end=hi
            ) for lo, hi in annotation_interval_set)

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

        for lo, hi in overlap_ranges:
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

                """First check for exact match
                if no exact match then check substrings
                e.g `Serpin A1` matched to `serpin A1`
                e.g `SerpinA1` matched to `serpin A1`

                We take the first case will not count hyphens separated
                because hard to infer if it was used as a space
                need to consider precedence in case gene and protein
                have the exact spelling correct annotated word
                """
                gene_protein_precedence_result = None
                if key1 > key2:
                    if anno1.text_in_document == anno1.keyword:
                        gene_protein_precedence_result = anno1
                    elif anno2.text_in_document == anno2.keyword:
                        gene_protein_precedence_result = anno2

                    # no match so far
                    if gene_protein_precedence_result is None:
                        if len(anno1.text_in_document.split(' ')) == len(anno1.keyword.split(' ')):
                            gene_protein_precedence_result = anno1
                        elif len(anno2.text_in_document.split(' ')) == len(anno2.keyword.split(' ')):  # noqa
                            gene_protein_precedence_result = anno2
                else:
                    if anno2.text_in_document == anno2.keyword:
                        gene_protein_precedence_result = anno2
                    elif anno1.text_in_document == anno1.keyword:
                        gene_protein_precedence_result = anno1

                    # no match so far
                    if gene_protein_precedence_result is None:
                        if len(anno2.text_in_document.split(' ')) == len(anno2.keyword.split(' ')):
                            gene_protein_precedence_result = anno2
                        elif len(anno1.text_in_document.split(' ')) == len(anno1.keyword.split(' ')):  # noqa
                            gene_protein_precedence_result = anno1

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
        tokens_list: List[PDFWord]
    ):
        """Returns coordinate positions and page numbers
        for all matching terms in the document
        """
        matches = []
        for token in tokens_list:
            if not is_case_insensitive:
                if token.keyword != keyword:
                    continue
            elif standardize_str(token.keyword).lower() != standardize_str(keyword).lower():
                continue
            rects = token.coordinates
            keywords = [token.keyword]
            matches.append({
                'pageNumber': token.page_number,
                'rects': rects,
                'keywords': keywords
            })
        return matches
