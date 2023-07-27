import bisect
import itertools
import time

from arango.client import ArangoClient
from collections import defaultdict
from typing import Dict, List, Set, Tuple

from app.logs import get_annotator_extras_obj, get_logger

from .annotation_service import AnnotationService
from .annotation_graph_service import get_genes_to_organisms, get_proteins_to_organisms
from .constants import EntityType
from .data_transfer_objects.dto import (
    Annotation,
    RecognizedEntities,
    LMDBMatch,
    SpecifiedOrganismStrain,
)
from .data_transfer_objects.dto_func_params import CreateAnnotationObjParams

logger = get_logger()


class EnrichmentAnnotationService(AnnotationService):
    def __init__(
        self,
        # TODO: I don't think this is the best way to handle the arango client connection, but the
        # pattern is pretty deeply ingrained into the annotations pipeline. Keeping it this way for
        # now, but I think we should slowly try to migrate away from the "service-as-an-object"
        # pattern.
        arango_client: ArangoClient
    ) -> None:
        super().__init__(arango_client=arango_client)

    def _annotate_type_gene(
        self, recognized_entities: RecognizedEntities
    ) -> List[Annotation]:
        matches_list: List[LMDBMatch] = recognized_entities.recognized_genes

        entities_to_create: List[CreateAnnotationObjParams] = []

        entity_token_pairs = []
        gene_names: Set[str] = set()
        for match in matches_list:
            entities_set = set()
            for entity in match.entities:
                gene_names.add(entity['synonym'])
                entities_set.add(
                    (entity['synonym'], entity['id_type'], entity.get('hyperlinks', ''))
                )
            for synonym, datasource, hyperlinks in entities_set:
                if hyperlinks == '':
                    hyperlinks = []
                entity_token_pairs.append(
                    (synonym, datasource, hyperlinks, match.token)
                )

        gene_names_list = list(gene_names)

        gene_match_time = time.time()
        fallback_graph_results = \
            get_genes_to_organisms(
                arango_client=self.arango_client,
                genes=gene_names_list,
                organisms=[self.specified_organism.organism_id],
            )
        logger.info(
            f'Gene fallback organism KG query time {time.time() - gene_match_time}',
            extra=get_annotator_extras_obj()
        )
        fallback_gene_organism_matches = fallback_graph_results.matches
        gene_data_sources = fallback_graph_results.data_sources
        gene_primary_names = fallback_graph_results.primary_names

        for (
            entity_synonym,
            entity_datasource,
            entity_hyperlinks,
            token,
        ) in entity_token_pairs:
            gene_id = None
            category = None
            organism_id = self.specified_organism.organism_id

            organisms_to_match: Dict[str, str] = {}
            if entity_synonym in fallback_gene_organism_matches:
                fallback_gene_organism_match = fallback_gene_organism_matches[
                    entity_synonym
                ]
                try:
                    # prioritize common name match over synonym
                    organisms_to_match = fallback_gene_organism_match[entity_synonym]
                except KeyError:
                    # an organism can have multiple different genes w/ same synonym
                    # since we don't know which to use, doing this is fine
                    for d in list(fallback_gene_organism_match.values()):
                        organisms_to_match = {**organisms_to_match, **d}
                try:
                    gene_id = organisms_to_match[self.specified_organism.organism_id]
                    category = self.specified_organism.category
                except KeyError:
                    continue
                else:
                    if (
                        entity_datasource
                        != gene_data_sources[f'{entity_synonym}{organism_id}']
                    ):
                        continue
                    entities_to_create.append(
                        CreateAnnotationObjParams(
                            token=token,
                            token_type=EntityType.GENE.value,
                            entity_synonym=entity_synonym,
                            entity_name=gene_primary_names[gene_id],
                            entity_id=gene_id,
                            entity_datasource=entity_datasource,
                            entity_hyperlinks=entity_hyperlinks,
                            entity_category=category,
                        )
                    )
        return self._create_annotation_object(entities_to_create)

    def _annotate_type_protein(
        self, recognized_entities: RecognizedEntities
    ) -> List[Annotation]:
        matches_list: List[LMDBMatch] = recognized_entities.recognized_proteins

        entities_to_create: List[CreateAnnotationObjParams] = []

        entity_token_pairs = []
        protein_names: Set[str] = set()
        for match in matches_list:
            entities_set = set()
            for entity in match.entities:
                protein_names.add(entity['synonym'])
                entities_set.add(
                    (
                        entity['synonym'],
                        entity.get('category', ''),
                        entity['id_type'],
                        entity.get('hyperlinks', ''),
                    )
                )
            for synonym, datasource, category, hyperlinks in entities_set:
                if hyperlinks == '':
                    hyperlinks = []
                entity_token_pairs.append(
                    (synonym, datasource, category, hyperlinks, match.token)
                )

        protein_names_list = list(protein_names)

        protein_match_time = time.time()
        organism = self.specified_organism
        organism_id = organism.organism_id
        fallback_graph_results = \
            get_proteins_to_organisms(
                arango_client=self.arango_client,
                proteins=protein_names_list,
                organisms=[organism_id],
            )
        logger.info(
            f'Protein fallback organism KG query time {time.time() - protein_match_time}',
            extra=get_annotator_extras_obj()
        )
        fallback_protein_organism_matches = fallback_graph_results.matches
        protein_primary_names = fallback_graph_results.primary_names

        for (
            entity_synonym,
            category,
            entity_datasource,
            entity_hyperlinks,
            token,
        ) in entity_token_pairs:
            # in LMDB we use the synonym as id and name, so do the same here
            protein_id = entity_synonym
            if entity_synonym in fallback_protein_organism_matches:
                try:
                    protein_id = fallback_protein_organism_matches[entity_synonym][
                        organism_id
                    ]
                    category = organism.category
                except KeyError:
                    continue

            entities_to_create.append(
                CreateAnnotationObjParams(
                    token=token,
                    token_type=EntityType.PROTEIN.value,
                    entity_id=protein_id,
                    entity_synonym=entity_synonym,
                    entity_name=protein_primary_names.get(protein_id, entity_synonym),
                    entity_datasource=entity_datasource,
                    entity_hyperlinks=entity_hyperlinks,
                    entity_category=category,
                )
            )
        return self._create_annotation_object(entities_to_create)

    def create_annotations(
        self,
        custom_annotations: List[dict],
        entity_results: RecognizedEntities,
        entity_type_and_id_pairs: List[Tuple[str, str]],
        specified_organism: SpecifiedOrganismStrain,
        **kwargs,
    ) -> List[Annotation]:
        self.specified_organism = specified_organism
        self.enrichment_mappings = kwargs['enrichment_mappings']

        annotations = self._create_annotations(
            types_to_annotate=entity_type_and_id_pairs,
            custom_annotations=custom_annotations,
            recognized_entities=entity_results,
        )

        start = time.time()
        cleaned = self._clean_annotations(annotations=annotations)

        logger.info(
            f'Time to clean and run annotation interval tree {time.time() - start}',
            extra=get_annotator_extras_obj()
        )
        return cleaned

    def _clean_annotations(self, annotations: List[Annotation]) -> List[Annotation]:
        fixed_unified_annotations = self._get_fixed_false_positive_unified_annotations(
            annotations_list=annotations
        )

        # need to split up the annotations otherwise
        # a text in a cell could be removed due to
        # overlapping with an adjacent cell
        split = defaultdict(list)
        offsets = [i for i, _ in self.enrichment_mappings]
        for anno in fixed_unified_annotations:
            # get first offset that is greater than hi_location_offset
            # this means the annotation is part of that cell/sublist
            index = bisect.bisect_left(offsets, anno.hi_location_offset)
            split[offsets[index]].append(anno)

        fixed_unified_annotations = list(
            itertools.chain.from_iterable(
                [
                    self.fix_conflicting_annotations(unified_annotations=v)
                    for _, v in split.items()
                ]
            )
        )
        return fixed_unified_annotations
