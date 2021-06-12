import bisect
import itertools
import time

from collections import defaultdict
from typing import Dict, List, Set, Tuple

from flask import current_app

from neo4japp.constants import LogEventType
from neo4japp.services.annotations.annotation_service import AnnotationService
from neo4japp.services.annotations import (
    AnnotationService,
    AnnotationDBService,
    AnnotationGraphService
)
from neo4japp.services.annotations.constants import EntityIdStr, EntityType
from neo4japp.services.annotations.data_transfer_objects import (
    Annotation,
    CreateAnnotationObjParams,
    RecognizedEntities,
    LMDBMatch,
    SpecifiedOrganismStrain
)
from neo4japp.utils.logger import EventLog


class EnrichmentAnnotationService(AnnotationService):
    def __init__(
        self,
        db: AnnotationDBService,
        graph: AnnotationGraphService,
    ) -> None:
        super().__init__(db=db, graph=graph)

    def _annotate_type_gene(
        self,
        recognized_entities: RecognizedEntities
    ) -> List[Annotation]:
        matches_list: List[LMDBMatch] = recognized_entities.recognized_genes

        entities_to_create: List[CreateAnnotationObjParams] = []

        entity_token_pairs = []
        gene_names: Set[str] = set()

        for match in matches_list:
            for entity in match.entities:
                entity_synonym = entity['name'] if entity.get('inclusion', None) else entity['synonym']  # noqa
                gene_names.add(entity_synonym)
                entity_token_pairs.append(
                    (entity, match.id_type, match.id_hyperlink, match.token))

        gene_names_list = list(gene_names)
        organism_ids = list(self.organism_frequency)
        fallback_gene_organism_matches = {}

        gene_match_time = time.time()
        fallback_gene_organism_matches = \
            self.graph.get_gene_to_organism_match_result(
                genes=gene_names_list,
                postgres_genes=self.db.get_organism_genes(
                    genes=gene_names_list, organism_ids=organism_ids),
                matched_organism_ids=[self.specified_organism.organism_id],
            )
        current_app.logger.info(
            f'Gene fallback organism KG query time {time.time() - gene_match_time}',
            extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
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
                if entity_synonym in fallback_gene_organism_matches:
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
                    else:
                        entities_to_create.append(
                            CreateAnnotationObjParams(
                                token=token,
                                token_type=EntityType.GENE.value,
                                entity=entity,
                                entity_id=gene_id,
                                entity_id_type=entity_id_type,
                                entity_id_hyperlink=entity_id_hyperlink,
                                entity_category=category
                            )
                        )
        return self._create_annotation_object(entities_to_create)

    def _annotate_type_protein(
        self,
        recognized_entities: RecognizedEntities
    ) -> List[Annotation]:
        matches_list: List[LMDBMatch] = recognized_entities.recognized_proteins

        entities_to_create: List[CreateAnnotationObjParams] = []

        entity_token_pairs = []
        protein_names: Set[str] = set()
        for match in matches_list:
            for entity in match.entities:
                entity_synonym = entity['synonym']
                protein_names.add(entity_synonym)
                entity_token_pairs.append(
                    (entity, match.id_type, match.id_hyperlink, match.token))

        protein_names_list = list(protein_names)
        fallback_protein_organism_matches = {}

        protein_match_time = time.time()
        fallback_protein_organism_matches = \
            self.graph.get_proteins_to_organisms(
                proteins=protein_names_list,
                organisms=[self.specified_organism.organism_id],
            )
        current_app.logger.info(
            f'Protein fallback organism KG query time {time.time() - protein_match_time}',
            extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
        )

        for entity, entity_id_type, entity_id_hyperlink, token in entity_token_pairs:
            category = entity.get('category', '')
            try:
                protein_id = entity[EntityIdStr.PROTEIN.value]
                entity_synonym = entity['synonym']
            except KeyError:
                continue
            else:
                if entity_synonym in fallback_protein_organism_matches:
                    try:
                        protein_id = fallback_protein_organism_matches[entity_synonym][self.specified_organism.organism_id]  # noqa
                        category = self.specified_organism.category
                    except KeyError:
                        continue
                    else:
                        entities_to_create.append(
                            CreateAnnotationObjParams(
                                token=token,
                                token_type=EntityType.PROTEIN.value,
                                entity=entity,
                                entity_id=protein_id,
                                entity_id_type=entity_id_type,
                                entity_id_hyperlink=entity_id_hyperlink,
                                entity_category=category
                            )
                        )
        return self._create_annotation_object(entities_to_create)

    def create_annotations(
        self,
        custom_annotations: List[dict],
        entity_results: RecognizedEntities,
        entity_type_and_id_pairs: List[Tuple[str, str]],
        specified_organism: SpecifiedOrganismStrain,
        **kwargs
    ) -> List[Annotation]:
        self.specified_organism = specified_organism

        annotations = self._create_annotations(
            types_to_annotate=entity_type_and_id_pairs,
            custom_annotations=custom_annotations,
            recognized_entities=entity_results
        )

        start = time.time()
        cleaned = self._clean_annotations(
            annotations=annotations,
            enrichment_mappings=kwargs['enrichment_mappings'])

        current_app.logger.info(
            f'Time to clean and run annotation interval tree {time.time() - start}',
            extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
        )
        return self.add_primary_name(annotations=cleaned)

    def _clean_annotations(
        self,
        annotations: List[Annotation],
        **kwargs
    ) -> List[Annotation]:
        fixed_unified_annotations = self._get_fixed_false_positive_unified_annotations(
            annotations_list=annotations)

        # need to split up the annotations otherwise
        # a text in a cell could be removed due to
        # overlapping with an adjacent cell
        split = defaultdict(list)
        offsets = [i for i, _ in kwargs['enrichment_mappings']]
        for anno in fixed_unified_annotations:
            # get first offset that is greater than hi_location_offset
            # this means the annotation is part of that cell/sublist
            index = bisect.bisect_left(offsets, anno.hi_location_offset)
            split[offsets[index]].append(anno)

        fixed_unified_annotations = list(itertools.chain.from_iterable(
            [self.fix_conflicting_annotations(unified_annotations=v) for _, v in split.items()]
        ))
        return fixed_unified_annotations
