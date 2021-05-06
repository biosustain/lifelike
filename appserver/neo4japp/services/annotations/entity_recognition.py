import json
import re

from string import digits, ascii_letters, punctuation, whitespace
from typing import Dict, List, Set, Tuple

from flask import current_app
from sqlalchemy import and_

from neo4japp.constants import LogEventType
from neo4japp.util import normalize_str
from neo4japp.utils.logger import EventLog
from neo4japp.models import GlobalList
from neo4japp.services.annotations import (
    AnnotationDBService,
    AnnotationGraphService
)
from neo4japp.services.annotations.constants import (
    ABBREVIATION_WORD_LENGTH,
    COMMON_WORDS,
    PDF_NEW_LINE_THRESHOLD,
    EntityType,
    EntityIdStr,
    ManualAnnotationType
)
from neo4japp.services.annotations.data_transfer_objects import (
    EntityResults,
    Inclusion,
    LMDBMatch,
    NLPResults,
    PDFWord
)
from neo4japp.services.annotations.lmdb_service import LMDBService
from neo4japp.services.annotations.lmdb_util import (
    create_ner_type_anatomy,
    create_ner_type_chemical,
    create_ner_type_compound,
    create_ner_type_disease,
    create_ner_type_food,
    create_ner_type_gene,
    create_ner_type_phenomena,
    create_ner_type_phenotype,
    create_ner_type_protein,
    create_ner_type_species,
    create_ner_type_company,
    create_ner_type_entity
)


class EntityRecognitionService:
    def __init__(
        self,
        db: AnnotationDBService,
        graph: AnnotationGraphService,
        lmdb: LMDBService
    ):
        self.lmdb = lmdb
        self.graph = graph
        self.db = db

        self.token_word_check_regex = re.compile(r'[\d{}]+$'.format(re.escape(punctuation)))

        self.entity_max_words = 6
        self.food_max_words = 4
        self.gene_max_words = 1

        self.exclusion_type_anatomy: Set[str] = set()
        self.exclusion_type_chemical: Set[str] = set()
        self.exclusion_type_compound: Set[str] = set()
        self.exclusion_type_disease: Set[str] = set()
        self.exclusion_type_food: Set[str] = set()
        self.exclusion_type_gene: Set[str] = set()
        self.exclusion_type_phenomena: Set[str] = set()
        self.exclusion_type_phenotype: Set[str] = set()
        self.exclusion_type_protein: Set[str] = set()
        self.exclusion_type_species: Set[str] = set()
        # non LMDB entities
        self.exclusion_type_company: Set[str] = set()
        self.exclusion_type_entity: Set[str] = set()

        self.type_gene_case_insensitive_exclusion: Set[str] = set()
        self.type_protein_case_insensitive_exclusion: Set[str] = set()

        self.inclusion_type_anatomy: Dict[str, Inclusion] = {}
        self.inclusion_type_chemical: Dict[str, Inclusion] = {}
        self.inclusion_type_compound: Dict[str, Inclusion] = {}
        self.inclusion_type_disease: Dict[str, Inclusion] = {}
        self.inclusion_type_food: Dict[str, Inclusion] = {}
        self.inclusion_type_gene: Dict[str, Inclusion] = {}
        self.inclusion_type_phenomena: Dict[str, Inclusion] = {}
        self.inclusion_type_phenotype: Dict[str, Inclusion] = {}
        self.inclusion_type_protein: Dict[str, Inclusion] = {}
        self.inclusion_type_species: Dict[str, Inclusion] = {}
        self.inclusion_type_species_local: Dict[str, Inclusion] = {}
        # non LMDB entities
        self.inclusion_type_company: Dict[str, Inclusion] = {}
        self.inclusion_type_entity: Dict[str, Inclusion] = {}

        self.gene_collection: List[Tuple[str, str, str, str, str]] = []
        self.abbreviations: Set[str] = set()

    def _get_annotation_type_anatomy_to_exclude(
        self,
        exclusion_list: List[dict]
    ):
        # case insensitive NOT punctuation insensitive
        for exclusion in exclusion_list:
            if exclusion.get('text') and exclusion.get('type') == EntityType.ANATOMY.value:
                self.exclusion_type_anatomy.add(exclusion.get('text').lower())  # type: ignore

    def _get_annotation_type_chemical_to_exclude(
        self,
        exclusion_list: List[dict]
    ):
        # case insensitive NOT punctuation insensitive
        for exclusion in exclusion_list:
            if exclusion.get('text') and exclusion.get('type') == EntityType.CHEMICAL.value:
                self.exclusion_type_chemical.add(exclusion.get('text').lower())  # type: ignore

    def _get_annotation_type_compound_to_exclude(
        self,
        exclusion_list: List[dict]
    ):
        # case insensitive NOT punctuation insensitive
        for exclusion in exclusion_list:
            if exclusion.get('text') and exclusion.get('type') == EntityType.COMPOUND.value:
                self.exclusion_type_compound.add(exclusion.get('text').lower())  # type: ignore

    def _get_annotation_type_disease_to_exclude(
        self,
        exclusion_list: List[dict]
    ):
        # case insensitive NOT punctuation insensitive
        for exclusion in exclusion_list:
            if exclusion.get('text') and exclusion.get('type') == EntityType.DISEASE.value:
                self.exclusion_type_disease.add(exclusion.get('text').lower())  # type: ignore

    def _get_annotation_type_food_to_exclude(
        self,
        exclusion_list: List[dict]
    ):
        # case insensitive NOT punctuation insensitive
        for exclusion in exclusion_list:
            if exclusion.get('text') and exclusion.get('type') == EntityType.FOOD.value:
                self.exclusion_type_food.add(exclusion.get('text').lower())  # type: ignore

    def _get_annotation_type_gene_to_exclude(
        self,
        exclusion_list: List[dict]
    ):
        for exclusion in exclusion_list:
            if exclusion.get('text') and exclusion.get('type') == EntityType.GENE.value:
                term = exclusion.get('text')
                if exclusion.get('isCaseInsensitive'):
                    self.type_gene_case_insensitive_exclusion.add(term.lower())  # type: ignore
                    continue
                self.exclusion_type_gene.add(term)  # type: ignore

    def _get_annotation_type_phenomena_to_exclude(
        self,
        exclusion_list: List[dict]
    ):
        # case insensitive NOT punctuation insensitive
        for exclusion in exclusion_list:
            if exclusion.get('text') and exclusion.get('type') == EntityType.PHENOMENA.value:
                self.exclusion_type_phenomena.add(exclusion.get('text').lower())  # type: ignore

    def _get_annotation_type_phenotype_to_exclude(
        self,
        exclusion_list: List[dict]
    ):
        # case insensitive NOT punctuation insensitive
        for exclusion in exclusion_list:
            if exclusion.get('text') and exclusion.get('type') == EntityType.PHENOTYPE.value:
                self.exclusion_type_phenotype.add(exclusion.get('text').lower())  # type: ignore

    def _get_annotation_type_protein_to_exclude(
        self,
        exclusion_list: List[dict]
    ):
        for exclusion in exclusion_list:
            if exclusion.get('text') and exclusion.get('type') == EntityType.PROTEIN.value:
                term = exclusion.get('text')
                if exclusion.get('isCaseInsensitive'):
                    self.type_protein_case_insensitive_exclusion.add(term.lower())  # type: ignore
                    continue
                self.exclusion_type_protein.add(term)  # type: ignore

    def _get_annotation_type_species_to_exclude(
        self,
        exclusion_list: List[dict]
    ):
        # case insensitive NOT punctuation insensitive
        for exclusion in exclusion_list:
            if exclusion.get('text') and exclusion.get('type') == EntityType.SPECIES.value:
                self.exclusion_type_species.add(exclusion.get('text').lower())  # type: ignore

    def _get_annotation_type_company_to_exclude(
        self,
        exclusion_list: List[dict]
    ):
        # case insensitive NOT punctuation insensitive
        for exclusion in exclusion_list:
            if exclusion.get('text') and exclusion.get('type') == EntityType.COMPANY.value:
                self.exclusion_type_company.add(exclusion.get('text').lower())  # type: ignore

    def _get_annotation_type_entity_to_exclude(
        self,
        exclusion_list: List[dict]
    ):
        # case insensitive NOT punctuation insensitive
        for exclusion in exclusion_list:
            if exclusion.get('text') and exclusion.get('type') == EntityType.ENTITY.value:
                self.exclusion_type_entity.add(exclusion.get('text').lower())  # type: ignore

    def is_anatomy_exclusion(self, word) -> bool:
        lowered = word.lower()
        if lowered in self.exclusion_type_anatomy:
            # current_app.logger.info(
            #     f'Found a match in anatomy entity lookup but token "{word}" is an exclusion.',  # noqa
            #     extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
            # )
            return True
        return False

    def is_chemical_exclusion(self, word) -> bool:
        lowered = word.lower()
        if lowered in self.exclusion_type_chemical:
            # current_app.logger.info(
            #     f'Found a match in chemicals entity lookup but token "{word}" is an exclusion.',  # noqa
            #     extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
            # )
            return True
        return False

    def is_compound_exclusion(self, word) -> bool:
        lowered = word.lower()
        if lowered in self.exclusion_type_compound:
            # current_app.logger.info(
            #     f'Found a match in compounds entity lookup but token "{word}" is an exclusion.',  # noqa
            #     extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
            # )
            return True
        return False

    def is_disease_exclusion(self, word) -> bool:
        lowered = word.lower()
        if lowered in self.exclusion_type_disease:
            # current_app.logger.info(
            #     f'Found a match in diseases entity lookup but token "{word}" is an exclusion.',  # noqa
            #     extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
            # )
            return True
        return False

    def is_food_exclusion(self, word) -> bool:
        lowered = word.lower()
        if lowered in self.exclusion_type_food:
            # current_app.logger.info(
            #     f'Found a match in foods entity lookup but token "{word}" is an exclusion.',  # noqa
            #     extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
            # )
            return True
        return False

    def is_gene_exclusion(self, word) -> bool:
        lowered = word.lower()
        if word in self.exclusion_type_gene or lowered in self.type_gene_case_insensitive_exclusion:
            # current_app.logger.info(
            #     f'Found a match in genes entity lookup but token "{word}" is an exclusion.',  # noqa
            #     extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
            # )
            return True
        return False

    def is_phenomena_exclusion(self, word) -> bool:
        lowered = word.lower()
        if lowered in self.exclusion_type_phenomena:
            # current_app.logger.info(
            #     f'Found a match in phenomenas entity lookup but token "{word}" is an exclusion.',  # noqa
            #     extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
            # )
            return True
        return False

    def is_phenotype_exclusion(self, word) -> bool:
        lowered = word.lower()
        if lowered in self.exclusion_type_phenotype:
            # current_app.logger.info(
            #         f'Found a match in phenotypes entity lookup but token "{word}" is an exclusion.',  # noqa
            #     extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
            # )
            return True
        return False

    def is_protein_exclusion(self, word) -> bool:
        lowered = word.lower()
        if word in self.exclusion_type_protein or lowered in self.type_protein_case_insensitive_exclusion:  # noqa
            # current_app.logger.info(
            #     f'Found a match in proteins entity lookup but token "{word}" is an exclusion.',  # noqa
            #     extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
            # )
            return True
        return False

    def is_species_exclusion(self, word) -> bool:
        lowered = word.lower()
        if lowered in self.exclusion_type_species:
            # current_app.logger.info(
            #     f'Found a match in species entity lookup but token "{word}" is an exclusion.',  # noqa
            #     extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
            # )
            return True
        return False

    def is_company_exclusion(self, word) -> bool:
        lowered = word.lower()
        if lowered in self.exclusion_type_company:
            # current_app.logger.info(
            #     f'Found a match in company entity lookup but token "{word}" is an exclusion.',  # noqa
            #     extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
            # )
            return True
        return False

    def is_entity_exclusion(self, word) -> bool:
        lowered = word.lower()
        if lowered in self.exclusion_type_entity:
            # current_app.logger.info(
            #     f'Found a match in entity lookup but token "{word}" is an exclusion.',  # noqa
            #     extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
            # )
            return True
        return False

    def set_entity_exclusions(self, excluded_annotations: List[dict]) -> None:
        exclusion_func = [
            self._get_annotation_type_anatomy_to_exclude,
            self._get_annotation_type_chemical_to_exclude,
            self._get_annotation_type_compound_to_exclude,
            self._get_annotation_type_disease_to_exclude,
            self._get_annotation_type_food_to_exclude,
            self._get_annotation_type_gene_to_exclude,
            self._get_annotation_type_phenomena_to_exclude,
            self._get_annotation_type_phenotype_to_exclude,
            self._get_annotation_type_protein_to_exclude,
            self._get_annotation_type_species_to_exclude,
            self._get_annotation_type_company_to_exclude,
            self._get_annotation_type_entity_to_exclude
        ]

        global_annotations_to_exclude = [
            exclusion for exclusion, in self.db.session.query(
                GlobalList.annotation).filter(
                    and_(
                        GlobalList.type == ManualAnnotationType.EXCLUSION.value,
                        # TODO: Uncomment once feature to review is there
                        # GlobalList.reviewed.is_(True),
                    )
                )
            ]

        for func in exclusion_func:
            func(global_annotations_to_exclude)

        # local exclusions
        # only get the custom species for now
        local_species_exclusions = [
            custom for custom in excluded_annotations if custom.get(
                'type') == EntityType.SPECIES.value and not custom.get(
                    'meta', {}).get('excludeGlobally')
        ]
        self._get_annotation_type_species_to_exclude(
            exclusion_list=local_species_exclusions
        )

    def _create_annotation_inclusions(
        self,
        annotations_to_include: List[dict],
        entity_type_to_include: str,
        entity_id_str: str,
        inclusion_collection: Dict[str, Inclusion],
        create_entity_ner_func,
    ) -> None:
        """Creates a dictionary structured very similar to LMDB.
        Used for entity custom annotation lookups.
        """
        for inclusion in annotations_to_include:
            try:
                entity_id = inclusion['meta']['id']
                entity_name = inclusion['meta']['allText']
                entity_type = inclusion['meta']['type']
                entity_id_type = inclusion['meta']['idType']
                entity_id_hyperlink = inclusion['meta']['idHyperlink']
            except KeyError:
                current_app.logger.info(
                    f'Error creating annotation inclusion {inclusion} for entity type {entity_type}',  # noqa
                    extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
                )
            else:
                normalized_entity_name = normalize_str(entity_name)

                if not entity_id:
                    # ID is required for global inclusions
                    # but we also include local species inclusion
                    entity_id = entity_name

                # entity_name could be empty strings
                # probably a result of testing
                # but will keep here just in case
                if entity_id and entity_name and entity_type == entity_type_to_include:
                    entity = {}
                    if entity_type in {
                        EntityType.ANATOMY.value,
                        EntityType.CHEMICAL.value,
                        EntityType.COMPOUND.value,
                        EntityType.DISEASE.value,
                        EntityType.FOOD.value,
                        EntityType.PHENOMENA.value,
                        EntityType.PHENOTYPE.value,
                        EntityType.SPECIES.value
                    }:
                        entity = create_entity_ner_func(
                            id_=entity_id,
                            name=entity_name,
                            synonym=entity_name
                        )
                    elif entity_type in {EntityType.COMPANY.value, EntityType.ENTITY.value}:
                        entity = create_entity_ner_func(
                            id_=entity_id, name=entity_name, synonym=entity_name)
                    else:
                        if entity_type == EntityType.GENE.value:
                            self.gene_collection.append(
                                (
                                    entity_id,
                                    entity_id_type,
                                    entity_id_hyperlink,
                                    entity_name,
                                    normalized_entity_name
                                )
                            )
                            continue
                        elif entity_type == EntityType.PROTEIN.value:
                            # protein is a bit different for now
                            entity = create_entity_ner_func(
                                name=entity_name,
                                synonym=entity_name
                            )

                    # differentiate between LMDB
                    entity['inclusion'] = True

                    if normalized_entity_name in inclusion_collection:
                        inclusion_collection[normalized_entity_name].entities.append(entity)
                    else:
                        inclusion_collection[normalized_entity_name] = Inclusion(
                            entities=[entity],
                            entity_id_type=entity_id_type,
                            entity_id_hyperlink=entity_id_hyperlink
                        )

    def _query_genes_from_kg(
        self,
        gene_inclusion: Dict[str, Inclusion]
    ) -> None:
        """Uses self.gene_collection and queries the knowledge
        graph for any matches.
        """
        # do this separately to make only one call to KG
        gene_ids = {i for i, _, _, _, _ in self.gene_collection}
        gene_names = self.graph.get_genes_from_gene_ids(gene_ids=list(gene_ids))

        current_app.logger.info(
            f'Failed to find a gene match in the knowledge graph for gene ids {gene_ids - set(gene_names)}.',  # noqa
            extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
        )

        for gene_id, entity_id_type, entity_id_hyperlink, entity_name, normalized_name in self.gene_collection:  # noqa
            if gene_names.get(gene_id, None):
                entity = create_ner_type_gene(
                    name=gene_names[gene_id],
                    synonym=entity_name
                )
                # differentiate between LMDB
                entity['inclusion'] = True

                if normalized_name in gene_inclusion:
                    gene_inclusion[normalized_name].entities.append(entity)
                else:
                    gene_inclusion[normalized_name] = Inclusion(
                        entities=[entity],
                        entity_id_type=entity_id_type,
                        entity_id_hyperlink=entity_id_hyperlink
                    )

    def set_entity_inclusions(
        self,
        custom_annotations: List[dict],
    ) -> None:
        inclusion_pairs = [
            (EntityType.ANATOMY.value, EntityIdStr.ANATOMY.value, self.inclusion_type_anatomy, create_ner_type_anatomy),  # noqa
            (EntityType.CHEMICAL.value, EntityIdStr.CHEMICAL.value, self.inclusion_type_chemical, create_ner_type_chemical),  # noqa
            (EntityType.COMPOUND.value, EntityIdStr.COMPOUND.value, self.inclusion_type_compound, create_ner_type_compound),  # noqa
            (EntityType.DISEASE.value, EntityIdStr.DISEASE.value, self.inclusion_type_disease, create_ner_type_disease),  # noqa
            (EntityType.FOOD.value, EntityIdStr.FOOD.value, self.inclusion_type_food, create_ner_type_food),  # noqa
            (EntityType.GENE.value, EntityIdStr.GENE.value, self.inclusion_type_gene, create_ner_type_gene),  # noqa
            (EntityType.PHENOMENA.value, EntityIdStr.PHENOMENA.value, self.inclusion_type_phenomena, create_ner_type_phenomena),  # noqa
            (EntityType.PHENOTYPE.value, EntityIdStr.PHENOTYPE.value, self.inclusion_type_phenotype, create_ner_type_phenotype),  # noqa
            (EntityType.PROTEIN.value, EntityIdStr.PROTEIN.value, self.inclusion_type_protein, create_ner_type_protein),  # noqa
            (EntityType.SPECIES.value, EntityIdStr.SPECIES.value, self.inclusion_type_species, create_ner_type_species),  # noqa
            # non LMDB entity types
            (EntityType.COMPANY.value, EntityIdStr.COMPANY.value, self.inclusion_type_company, create_ner_type_company),  # noqa
            (EntityType.ENTITY.value, EntityIdStr.ENTITY.value, self.inclusion_type_entity, create_ner_type_entity)  # noqa
        ]

        global_annotations_to_include = [
            inclusion for inclusion, in self.db.session.query(
                GlobalList.annotation).filter(
                    and_(
                        GlobalList.type == ManualAnnotationType.INCLUSION.value,
                        # TODO: Uncomment once feature to review is there
                        # GlobalList.reviewed.is_(True),
                    )
                )
            ]

        for entity_type, entity_id_str, inclusion, func in inclusion_pairs:
            self._create_annotation_inclusions(
                annotations_to_include=global_annotations_to_include,
                entity_type_to_include=entity_type,
                entity_id_str=entity_id_str,
                inclusion_collection=inclusion,
                create_entity_ner_func=func
            )
        self._query_genes_from_kg(self.inclusion_type_gene)

        # local inclusions
        # only get the custom species for now
        local_species_inclusions = [
            custom for custom in custom_annotations if custom.get(
                'meta', {}).get('type') == EntityType.SPECIES.value and not custom.get(
                    'meta', {}).get('includeGlobally')
        ]
        self._create_annotation_inclusions(
            annotations_to_include=local_species_inclusions,
            entity_type_to_include=EntityType.SPECIES.value,
            entity_id_str=EntityIdStr.SPECIES.value,
            inclusion_collection=self.inclusion_type_species_local,
            create_entity_ner_func=create_ner_type_species
        )

    def is_abbrev(self, token: PDFWord) -> bool:
        """Determine if a word is an abbreviation.

        Start from closest word to abbreviation, and check the first character.
        """
        if token.keyword in self.abbreviations:
            return True

        if len(token.keyword) not in ABBREVIATION_WORD_LENGTH:
            return False

        # a token will only have previous words
        # if it is a possible abbreviation
        # the assumption here is, if an abbreviation
        # is used the *first time*, it will have previous
        # words that it is an abbreviation of
        # any subsequent uses of the abbreviation
        # will not have the word it is abbreviated from
        # as a previous word in the document
        if not token.previous_words:
            return False

        abbrev = ''
        len_of_word = len(token.keyword)
        previous_words = token.previous_words.split(' ')
        for w in reversed(previous_words):
            if '-' in w:
                split = w.split('-')
                for w2 in reversed(split):
                    if w2:
                        abbrev = w2[0].upper() + abbrev
            elif '/' in w:
                split = w.split('/')
                for w2 in reversed(split):
                    if w2:
                        abbrev = w2[0].upper() + abbrev
            else:
                abbrev = w[0].upper() + abbrev
        abbrev = abbrev[-len_of_word:]

        if abbrev == token.keyword:
            self.abbreviations.add(token.keyword)
            return True
        return False

    def generate_tokens(self, tokens_list: List[PDFWord]) -> List[PDFWord]:
        prev_token = None
        new_tokens = []

        for token in tokens_list:
            if prev_token is None:
                if (token.keyword.lower() in COMMON_WORDS or
                    self.token_word_check_regex.match(token.keyword) or
                    token.keyword in ascii_letters or
                    token.keyword in digits or
                    len(token.normalized_keyword) <= 2 or
                    self.is_abbrev(token)
                ):  # noqa
                    continue
                else:
                    # copied from def normalize_str
                    # to avoid function calls, ~7-10 sec faster
                    normalized = token.keyword.lower()
                    normalized = normalized.translate(str.maketrans('', '', punctuation))
                    normalized_keyword = normalized.translate(str.maketrans('', '', whitespace))
                    new_token = PDFWord(
                        keyword=token.keyword,
                        normalized_keyword=normalized_keyword,
                        page_number=token.page_number,
                        lo_location_offset=token.lo_location_offset,
                        hi_location_offset=token.hi_location_offset,
                        coordinates=token.coordinates,
                        heights=token.heights,
                        widths=token.widths,
                        previous_words=token.previous_words
                    )
                    new_tokens.append(new_token)
                    prev_token = new_token
            else:
                words_subset = [prev_token, token]
                curr_keyword = ' '.join([word.keyword for word in words_subset])
                coordinates = []
                heights = []
                widths = []

                start_lower_x = 0.0
                start_lower_y = 0.0
                end_upper_x = 0.0
                end_upper_y = 0.0
                prev_height = 0.0
                for word in words_subset:
                    # when combining sequential words
                    # need to merge their coordinates together
                    # while also keeping in mind words on new lines
                    for j, coords in enumerate(word.coordinates):
                        lower_x, lower_y, upper_x, upper_y = coords

                        if (start_lower_x == 0.0 and
                                start_lower_y == 0.0 and
                                end_upper_x == 0.0 and
                                end_upper_y == 0.0):
                            start_lower_x = lower_x
                            start_lower_y = lower_y
                            end_upper_x = upper_x
                            end_upper_y = upper_y
                            prev_height = word.heights[j]
                        else:
                            if lower_y != start_lower_y:
                                diff = abs(lower_y - start_lower_y)

                                # if diff is greater than height ratio
                                # then part of keyword is on a new line
                                if diff > prev_height * PDF_NEW_LINE_THRESHOLD:
                                    coordinates.append(
                                        [start_lower_x, start_lower_y, end_upper_x, end_upper_y])

                                    start_lower_x = lower_x
                                    start_lower_y = lower_y
                                    end_upper_x = upper_x
                                    end_upper_y = upper_y
                                    prev_height = word.heights[j]
                                else:
                                    if upper_y > end_upper_y:
                                        end_upper_y = upper_y

                                    if upper_x > end_upper_x:
                                        end_upper_x = upper_x
                            else:
                                if upper_y > end_upper_y:
                                    end_upper_y = upper_y

                                if upper_x > end_upper_x:
                                    end_upper_x = upper_x

                    heights += word.heights
                    widths += word.widths
                coordinates.append([start_lower_x, start_lower_y, end_upper_x, end_upper_y])

                # copied from def normalize_str
                # to avoid function calls, ~7-10 sec faster
                normalized = curr_keyword.lower()
                normalized = normalized.translate(str.maketrans('', '', punctuation))
                normalized_keyword = normalized.translate(str.maketrans('', '', whitespace))
                new_token = PDFWord(
                    keyword=curr_keyword,
                    normalized_keyword=normalized_keyword,
                    # take the page of the first word
                    # if multi-word, consider it as part
                    # of page of first word
                    page_number=words_subset[0].page_number,
                    lo_location_offset=words_subset[0].lo_location_offset,
                    hi_location_offset=words_subset[-1].hi_location_offset,
                    coordinates=coordinates,
                    heights=heights,
                    widths=widths,
                    previous_words=words_subset[0].previous_words,
                )

                if (new_token.keyword.lower() in COMMON_WORDS or
                    self.token_word_check_regex.match(new_token.keyword) or
                    new_token.keyword in ascii_letters or
                    new_token.keyword in digits or
                    len(new_token.normalized_keyword) <= 2 or
                    self.is_abbrev(new_token)
                ):  # noqa
                    continue
                else:
                    new_tokens.append(new_token)
                    prev_token = new_token
        return new_tokens

    def _check_lmdb_genes(self, nlp_results: NLPResults, tokens: List[PDFWord]):
        keys = {token.normalized_keyword for token in tokens}

        cursor = self.lmdb.session.genes_txn.cursor()
        global_inclusion = self.inclusion_type_gene
        exclude_token = self.is_gene_exclusion

        matched_results = cursor.getmulti([k.encode('utf-8') for k in keys], dupdata=True)
        key_results: Dict[str, List[dict]] = {}
        key_id_type: Dict[str, str] = {}
        key_id_hyperlink: Dict[str, str] = {}

        for key, value in matched_results:
            decoded_key = key.decode('utf-8')
            match_list = key_results.get(decoded_key, [])
            match_list.append(json.loads(value))
            key_results[decoded_key] = match_list

        # gene is a bit different
        # we want both from lmdb and inclusions
        # not only check inclusions for keys not in lmdb
        # because a global could normalize to something already in
        # LMDB, e.g IL-8 is a global inclusion, but il8 is already
        # normalized in LMDB from IL8
        for key in keys:
            found = global_inclusion.get(key, None)
            if found:
                match_list = key_results.get(key, [])
                match_list += found.entities
                key_results[key] = match_list
                key_id_type[key] = found.entity_id_type
                key_id_hyperlink[key] = found.entity_id_hyperlink

        lmdb_matches = []
        for token in tokens:
            if token.normalized_keyword in key_results and not exclude_token(token.keyword):
                match = LMDBMatch(
                    entities=key_results[token.normalized_keyword],
                    token=token,
                    id_type=key_id_type.get(token.normalized_keyword, ''),
                    id_hyperlink=key_id_hyperlink.get(token.normalized_keyword, '')
                )
                offset_key = (token.lo_location_offset, token.hi_location_offset)
                # if an entity set in nlp_results is not empty
                # that means NLP was used
                # NLP is veto, so if not found it vetos
                if nlp_results.genes:
                    if offset_key in nlp_results.genes:
                        lmdb_matches.append(match)
                else:
                    lmdb_matches.append(match)
        return lmdb_matches

    def _check_lmdb_species(self, tokens: List[PDFWord]):
        keys = {token.normalized_keyword for token in tokens}

        cursor = self.lmdb.session.species_txn.cursor()
        global_inclusion = self.inclusion_type_species
        local_inclusion = self.inclusion_type_species_local
        exclude_token = self.is_species_exclusion

        matched_results = cursor.getmulti([k.encode('utf-8') for k in keys], dupdata=True)
        key_results: Dict[str, List[dict]] = {}
        key_results_local: Dict[str, List[dict]] = {}
        key_id_type: Dict[str, str] = {}
        key_id_hyperlink: Dict[str, str] = {}

        for key, value in matched_results:
            decoded_key = key.decode('utf-8')
            match_list = key_results.get(decoded_key, [])
            match_list.append(json.loads(value))
            key_results[decoded_key] = match_list

        unmatched_keys = keys - set(key_results)

        # for species, check both global and local inclusions
        for key in unmatched_keys:
            found = global_inclusion.get(key, None)
            if found:
                key_results[key] = found.entities
                key_id_type[key] = found.entity_id_type
                key_id_hyperlink[key] = found.entity_id_hyperlink

        unmatched_keys = keys - set(key_results)

        for key in unmatched_keys:
            found = local_inclusion.get(key, None)
            if found:
                key_results_local[key] = found.entities
                key_id_type[key] = found.entity_id_type
                key_id_hyperlink[key] = found.entity_id_hyperlink

        lmdb_matches = []
        lmdb_matches_local = []
        for token in tokens:
            if not exclude_token(token.keyword):
                if token.normalized_keyword in key_results:
                    lmdb_matches.append(
                        LMDBMatch(
                            entities=key_results[token.normalized_keyword],
                            token=token,
                            id_type=key_id_type.get(token.normalized_keyword, ''),
                            id_hyperlink=key_id_hyperlink.get(token.normalized_keyword, '')
                        )
                    )
                elif token.normalized_keyword in key_results_local:
                    lmdb_matches_local.append(
                        LMDBMatch(
                            entities=key_results_local[token.normalized_keyword],
                            token=token,
                            id_type=key_id_type.get(token.normalized_keyword, ''),
                            id_hyperlink=key_id_hyperlink.get(token.normalized_keyword, '')
                        )
                    )
        return lmdb_matches, lmdb_matches_local

    def check_lmdb(self, nlp_results: NLPResults, tokens: List[PDFWord]):
        results = EntityResults()
        original_keys = {token.normalized_keyword for token in tokens}

        for entity_type in [entity.value for entity in EntityType]:
            # because an entity type can create its own set of keys
            # need to reset for next iteration
            keys = original_keys
            cursor = None
            global_inclusion = None
            id_type = None
            id_hyperlink = None

            if entity_type == EntityType.ANATOMY.value:
                cursor = self.lmdb.session.anatomy_txn.cursor()
                global_inclusion = self.inclusion_type_anatomy
                exclude_token = self.is_anatomy_exclusion

            elif entity_type == EntityType.CHEMICAL.value:
                cursor = self.lmdb.session.chemicals_txn.cursor()
                global_inclusion = self.inclusion_type_chemical
                exclude_token = self.is_chemical_exclusion

            elif entity_type == EntityType.COMPOUND.value:
                cursor = self.lmdb.session.compounds_txn.cursor()
                global_inclusion = self.inclusion_type_compound
                exclude_token = self.is_compound_exclusion

            elif entity_type == EntityType.DISEASE.value:
                cursor = self.lmdb.session.diseases_txn.cursor()
                global_inclusion = self.inclusion_type_disease
                exclude_token = self.is_disease_exclusion

            elif entity_type == EntityType.FOOD.value:
                cursor = self.lmdb.session.foods_txn.cursor()
                global_inclusion = self.inclusion_type_food
                exclude_token = self.is_food_exclusion
                keys = {token.normalized_keyword for token in tokens
                        if len(token.keyword.split(' ')) <= self.food_max_words}

            elif entity_type == EntityType.GENE.value:
                gene_matches = self._check_lmdb_genes(
                    nlp_results=nlp_results,
                    tokens=[token for token in tokens if len(
                        token.keyword.split(' ')) <= self.gene_max_words])
                results.matched_type_gene = gene_matches
                continue

            elif entity_type == EntityType.PHENOMENA.value:
                cursor = self.lmdb.session.phenomenas_txn.cursor()
                global_inclusion = self.inclusion_type_phenomena
                exclude_token = self.is_phenomena_exclusion

            elif entity_type == EntityType.PHENOTYPE.value:
                cursor = self.lmdb.session.phenotypes_txn.cursor()
                global_inclusion = self.inclusion_type_phenotype
                exclude_token = self.is_phenotype_exclusion

            elif entity_type == EntityType.PROTEIN.value:
                cursor = self.lmdb.session.proteins_txn.cursor()
                global_inclusion = self.inclusion_type_protein
                exclude_token = self.is_protein_exclusion

            elif entity_type == EntityType.SPECIES.value:
                species_matches, species_matches_local = self._check_lmdb_species(
                    tokens=tokens)
                results.matched_type_species = species_matches
                results.matched_type_species_local = species_matches_local
                continue

            # non lmdb lookups
            elif entity_type == EntityType.COMPANY.value:
                global_inclusion = self.inclusion_type_company
                exclude_token = self.is_company_exclusion
                results.matched_type_company = [
                    LMDBMatch(
                        entities=global_inclusion[token.normalized_keyword].entities,
                        token=token,
                        id_type=global_inclusion[token.normalized_keyword].entity_id_type,
                        id_hyperlink=global_inclusion[token.normalized_keyword].entity_id_hyperlink
                    ) for token in tokens if global_inclusion.get(
                        token.normalized_keyword) and not exclude_token(token.keyword)]
                continue

            # non lmdb lookups
            elif entity_type == EntityType.ENTITY.value:
                global_inclusion = self.inclusion_type_entity
                exclude_token = self.is_entity_exclusion
                results.matched_type_entity = [
                    LMDBMatch(
                        entities=global_inclusion[token.normalized_keyword].entities,
                        token=token,
                        id_type=global_inclusion[token.normalized_keyword].entity_id_type,
                        id_hyperlink=global_inclusion[token.normalized_keyword].entity_id_hyperlink
                    ) for token in tokens if global_inclusion.get(
                        token.normalized_keyword) and not exclude_token(token.keyword)]
                continue

            if cursor is not None and global_inclusion is not None:
                matched_results = cursor.getmulti([k.encode('utf-8') for k in keys], dupdata=True)
                key_results: Dict[str, List[dict]] = {}
                key_id_type: Dict[str, str] = {}
                key_id_hyperlink: Dict[str, str] = {}

                for key, value in matched_results:
                    decoded_key = key.decode('utf-8')
                    match_list = key_results.get(decoded_key, [])
                    match_list.append(json.loads(value))
                    key_results[decoded_key] = match_list

                unmatched_keys = keys - set(key_results)

                for key in unmatched_keys:
                    found = global_inclusion.get(key, None)
                    if found:
                        key_results[key] = found.entities
                        key_id_type[key] = found.entity_id_type
                        key_id_hyperlink[key] = found.entity_id_hyperlink

                lmdb_matches = []
                for token in tokens:
                    if token.normalized_keyword in key_results and not exclude_token(token.keyword):
                        match = LMDBMatch(
                            entities=key_results[token.normalized_keyword],
                            token=token,
                            id_type=key_id_type.get(token.normalized_keyword, ''),
                            id_hyperlink=key_id_hyperlink.get(token.normalized_keyword, '')
                        )
                        offset_key = (token.lo_location_offset, token.hi_location_offset)
                        # only a few entities currently have NLP
                        # if an entity set in nlp_results is not empty
                        # that means NLP was used
                        # NLP is veto, so if not found it vetos
                        if entity_type == EntityType.CHEMICAL.value and nlp_results.chemicals:
                            if offset_key in nlp_results.chemicals:
                                lmdb_matches.append(match)
                        elif entity_type == EntityType.COMPOUND.value and nlp_results.compounds:
                            if offset_key in nlp_results.compounds:
                                lmdb_matches.append(match)
                        elif entity_type == EntityType.DISEASE.value and nlp_results.diseases:
                            if offset_key in nlp_results.diseases:
                                lmdb_matches.append(match)
                        else:
                            lmdb_matches.append(match)

                if entity_type == EntityType.ANATOMY.value:
                    results.matched_type_anatomy = lmdb_matches

                elif entity_type == EntityType.CHEMICAL.value:
                    results.matched_type_chemical = lmdb_matches

                elif entity_type == EntityType.COMPOUND.value:
                    results.matched_type_compound = lmdb_matches

                elif entity_type == EntityType.DISEASE.value:
                    results.matched_type_disease = lmdb_matches

                elif entity_type == EntityType.FOOD.value:
                    results.matched_type_food = lmdb_matches

                elif entity_type == EntityType.PHENOMENA.value:
                    results.matched_type_phenomena = lmdb_matches

                elif entity_type == EntityType.PHENOTYPE.value:
                    results.matched_type_phenotype = lmdb_matches

                elif entity_type == EntityType.PROTEIN.value:
                    results.matched_type_protein = lmdb_matches
        return results

    def identify(
        self,
        custom_annotations: List[dict],
        excluded_annotations: List[dict],
        tokens: List[PDFWord],
        nlp_results: NLPResults
    ) -> EntityResults:
        self.set_entity_exclusions(excluded_annotations)
        self.set_entity_inclusions(custom_annotations)

        generated_tokens = [
            current_token for idx, token in enumerate(tokens)
                for current_token in self.generate_tokens(
                    tokens[idx:self.entity_max_words + idx])]  # noqa

        return self.check_lmdb(nlp_results=nlp_results, tokens=generated_tokens)
