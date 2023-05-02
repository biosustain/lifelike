import json
import time

from typing import Dict, List, Optional, Tuple

from app.logs import get_annotator_extras_obj, get_logger
from app.utils import normalize_str

from .annotation_graph_service import get_entity_inclusions
from .arangodb import create_arango_client
from .constants import PARSER_PDF_ENDPOINT, PARSER_TEXT_ENDPOINT, SPECIES_LMDB, EntityType
from .data_transfer_objects.dto import (
    GlobalExclusions,
    GlobalInclusions,
    PDFWord,
    SpecifiedOrganismStrain
)
from .exceptions import AnnotationError
from .utils.nlp import predict
from .utils.parsing import get_parser_args_for_file, get_parser_args_for_text, request_parse

logger = get_logger()


class Pipeline:
    """Pipeline of steps involved in annotation of PDFs, enrichment tables, etc.

    The purpose of the pipeline is to assemble several steps involved in the
    annotation process, and allow a single interface to interact through.

    :param steps : dict
        Dict of {name: step} that are required for processing annotations.
        Step here is the service init function.
    :param kwargs : dict
        Currently accept two keyword args:
            (1) text : str
            (2) parsed : list
                List of PDFWord objects representing words in text.
    """
    def __init__(self, steps: dict, text: str, parsed: List[PDFWord]):
        if not all(k in ['aers', 'tkner', 'as', 'bs'] for k in steps):
            raise AnnotationError(
                'Unable to Annotate',
                'Configurations for the annotation pipeline is incorrect, please try again later.')
        if not text:
            text = ''
        if not parsed:
            parsed = []

        self.steps = steps
        self.text = text
        self.parsed = parsed
        self.entities = None
        self.global_exclusions: Optional[GlobalExclusions] = None
        self.global_inclusions: Optional[GlobalInclusions] = None

    # TODO: May be better to squash this and the `parse_text` method below, revisit this once we
    # tackle annotating enrichment tables.
    @classmethod
    def parse_file(self, file_id: int, exclude_references: bool) -> Tuple[str, List[PDFWord]]:
        """
        :param file_id : int
        :param exclude_references : bool
        """
        # TODO: Probably shouldn't completely fail here, better to gracefully handle with a
        # warning message...
        if not file_id:
            raise AnnotationError('Unable to Annotate', 'No file ID provided.')
        return request_parse(
            url=PARSER_PDF_ENDPOINT,
            data=get_parser_args_for_file(file_id, exclude_references)
        )

    @classmethod
    def parse_text(self, text: str) -> Tuple[str, List[PDFWord]]:
        """
        :param text : str
        """
        # TODO: Probably shouldn't completely fail here, better to gracefully handle with a
        # warning message...
        if not text:
            raise AnnotationError('Unable to Annotate', 'No text provided.')
        return request_parse(url=PARSER_TEXT_ENDPOINT, data=get_parser_args_for_text(text))

    @classmethod
    def get_entity_exclusions(
        self,
        global_exclusions: List[dict],
        local_exclusions: List[dict]
    ) -> GlobalExclusions:
        """Returns set of combined global and local exclusions
        for each entity type.

        :param exclusions:  excluded annotations relative to file
            - need to be filtered for local exclusions
        """
        exclusion_sets: Dict[EntityType, set] = {
            EntityType.ANATOMY: set(),
            EntityType.CHEMICAL: set(),
            EntityType.COMPOUND: set(),
            EntityType.DISEASE: set(),
            EntityType.FOOD: set(),
            EntityType.GENE: set(),
            EntityType.PHENOMENA: set(),
            EntityType.PHENOTYPE: set(),
            EntityType.PROTEIN: set(),
            EntityType.SPECIES: set(),
            EntityType.COMPANY: set(),
            EntityType.ENTITY: set(),
            EntityType.LAB_SAMPLE: set(),
            EntityType.LAB_STRAIN: set()
        }

        exclusion_sets_case_insensitive: Dict[EntityType, set] = {
            EntityType.GENE: set(),
            EntityType.PROTEIN: set()
        }

        for exclude in global_exclusions + local_exclusions:
            try:
                excluded_text = exclude['text']
                entity_type = EntityType.get(exclude['type'])
            except KeyError:
                continue

            if excluded_text and entity_type in exclusion_sets:
                if entity_type == EntityType.GENE or entity_type == EntityType.PROTEIN:
                    if exclude.get('isCaseInsensitive', False):
                        if entity_type in exclusion_sets_case_insensitive:
                            exclusion_sets_case_insensitive[entity_type].add(excluded_text.lower())
                    else:
                        exclusion_sets[entity_type].add(excluded_text)
                else:
                    exclusion_sets[entity_type].add(excluded_text.lower())

        return GlobalExclusions(
            excluded_anatomy=exclusion_sets[EntityType.ANATOMY],
            excluded_chemicals=exclusion_sets[EntityType.CHEMICAL],
            excluded_compounds=exclusion_sets[EntityType.COMPOUND],
            excluded_diseases=exclusion_sets[EntityType.DISEASE],
            excluded_foods=exclusion_sets[EntityType.FOOD],
            excluded_genes=exclusion_sets[EntityType.GENE],
            excluded_phenomenas=exclusion_sets[EntityType.PHENOMENA],
            excluded_phenotypes=exclusion_sets[EntityType.PHENOTYPE],
            excluded_proteins=exclusion_sets[EntityType.PROTEIN],
            excluded_species=exclusion_sets[EntityType.SPECIES],
            excluded_genes_case_insensitive=exclusion_sets_case_insensitive[EntityType.GENE],
            excluded_proteins_case_insensitive=exclusion_sets_case_insensitive[EntityType.PROTEIN],
            excluded_companies=exclusion_sets[EntityType.COMPANY],
            excluded_entities=exclusion_sets[EntityType.ENTITY],
            excluded_lab_strains=exclusion_sets[EntityType.LAB_STRAIN],
            excluded_lab_samples=exclusion_sets[EntityType.LAB_SAMPLE]
        )

    def get_globals(
        self,
        global_exclusions: List[dict],
        local_exclusions: List[dict],
        local_inclusions: List[dict]
    ):
        arango_client = create_arango_client()

        start = time.time()
        self.global_exclusions = self.get_entity_exclusions(global_exclusions, local_exclusions)
        self.global_inclusions = get_entity_inclusions(arango_client, local_inclusions)
        logger.info(
            f'Time to process entity exclusions/inclusions {time.time() - start}',
            extra=get_annotator_extras_obj()
        )
        return self

    def identify(self, annotation_methods: dict):
        self.er_service = self.steps['aers'](
            exclusions=self.global_exclusions, inclusions=self.global_inclusions)
        tokenizer = self.steps['tkner']()

        # identify entities w/ NLP first
        entities_to_run_nlp = set(k for k, v in annotation_methods.items() if v['nlp'])
        start = time.time()
        nlp_results = predict(text=self.text, entities=entities_to_run_nlp)
        logger.info(
            f'Total NLP processing time for entities {entities_to_run_nlp} {time.time() - start}',
            extra=get_annotator_extras_obj()
        )

        start = time.time()
        tokens = tokenizer.create(self.parsed)
        logger.info(
            f'Time to tokenize PDF words {time.time() - start}',
            extra=get_annotator_extras_obj()
        )

        start = time.time()
        self.entities = self.er_service.identify(tokens=tokens, nlp_results=nlp_results)
        logger.info(
            f'Total LMDB lookup time {time.time() - start}',
            extra=get_annotator_extras_obj()
        )
        return self

    def annotate(
        self,
        specified_organism_synonym: str,
        specified_organism_tax_id: str,
        custom_annotations: dict,
        file_id: int,
        enrichment_mappings: dict = {}
    ):
        annotator = self.steps['as']()
        bioc_service = self.steps['bs']()

        self.create_fallback_organism(
            specified_organism_synonym,
            specified_organism_tax_id
        )

        start = time.time()
        annotations = annotator.create_annotations(
            custom_annotations=custom_annotations,
            entity_results=self.entities,
            entity_type_and_id_pairs=annotator.get_entities_to_annotate(),
            specified_organism=self.fallback_organism,
            enrichment_mappings=enrichment_mappings
        )

        logger.info(
            f'Time to create annotations {time.time() - start}',
            extra=get_annotator_extras_obj()
        )

        bioc = bioc_service.read(text=self.text, file_uri=file_id)
        return bioc_service.generate_bioc_json(annotations=annotations, bioc=bioc)

    def create_fallback_organism(
        self,
        specified_organism_synonym: str,
        specified_organism_tax_id: str
    ):
        entity_synonym = ''
        entity_id = ''
        entity_category = ''

        if specified_organism_synonym and specified_organism_tax_id:
            entity_synonym = normalize_str(specified_organism_synonym)
            entity_id = specified_organism_tax_id
            try:
                with self.er_service.lmdb.begin(SPECIES_LMDB) as txn:
                    entity_category = json.loads(
                        txn.get(entity_synonym.encode('utf-8')))['category']
            except (KeyError, TypeError, Exception):
                # could not get data from lmdb
                logger.info(
                    f'Failed to get category for fallback organism "{specified_organism_synonym}".',
                    extra=get_annotator_extras_obj()
                )
                entity_category = 'Uncategorized'
        self.fallback_organism = SpecifiedOrganismStrain(
            synonym=entity_synonym, organism_id=entity_id, category=entity_category)
        return self
