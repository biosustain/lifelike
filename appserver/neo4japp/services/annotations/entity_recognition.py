import json
import re

from string import digits, ascii_letters, punctuation
from typing import Dict, List, Set, Tuple

from flask import current_app
from sqlalchemy import and_

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
    SPECIES_EXCLUSION,
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
                self.exclusion_type_chemical.add(exclusion.get('text').lower())  # type: ignore

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
            #     extra=EventLog(event_type='annotations').to_dict()
            # )
            return True
        return False

    def is_chemical_exclusion(self, word) -> bool:
        lowered = word.lower()
        if lowered in self.exclusion_type_chemical:
            # current_app.logger.info(
            #     f'Found a match in chemicals entity lookup but token "{word}" is an exclusion.',  # noqa
            #     extra=EventLog(event_type='annotations').to_dict()
            # )
            return True
        return False

    def is_compound_exclusion(self, word) -> bool:
        lowered = word.lower()
        if lowered in self.exclusion_type_compound:
            # current_app.logger.info(
            #     f'Found a match in compounds entity lookup but token "{word}" is an exclusion.',  # noqa
            #     extra=EventLog(event_type='annotations').to_dict()
            # )
            return True
        return False

    def is_disease_exclusion(self, word) -> bool:
        lowered = word.lower()
        if lowered in self.exclusion_type_disease:
            # current_app.logger.info(
            #     f'Found a match in diseases entity lookup but token "{word}" is an exclusion.',  # noqa
            #     extra=EventLog(event_type='annotations').to_dict()
            # )
            return True
        return False

    def is_food_exclusion(self, word) -> bool:
        lowered = word.lower()
        if lowered in self.exclusion_type_food:
            # current_app.logger.info(
            #     f'Found a match in foods entity lookup but token "{word}" is an exclusion.',  # noqa
            #     extra=EventLog(event_type='annotations').to_dict()
            # )
            return True
        return False

    def is_gene_exclusion(self, word) -> bool:
        lowered = word.lower()
        if word in self.exclusion_type_gene or lowered in self.type_gene_case_insensitive_exclusion:
            # current_app.logger.info(
            #     f'Found a match in genes entity lookup but token "{word}" is an exclusion.',  # noqa
            #     extra=EventLog(event_type='annotations').to_dict()
            # )
            return True
        return False

    def is_phenomena_exclusion(self, word) -> bool:
        lowered = word.lower()
        if lowered in self.exclusion_type_phenomena:
            # current_app.logger.info(
            #     f'Found a match in phenomenas entity lookup but token "{word}" is an exclusion.',  # noqa
            #     extra=EventLog(event_type='annotations').to_dict()
            # )
            return True
        return False

    def is_phenotype_exclusion(self, word) -> bool:
        lowered = word.lower()
        if lowered in self.exclusion_type_phenotype:
            # current_app.logger.info(
            #         f'Found a match in phenotypes entity lookup but token "{word}" is an exclusion.',  # noqa
            #     extra=EventLog(event_type='annotations').to_dict()
            # )
            return True
        return False

    def is_protein_exclusion(self, word) -> bool:
        lowered = word.lower()
        if word in self.exclusion_type_protein or lowered in self.type_protein_case_insensitive_exclusion:  # noqa
            # current_app.logger.info(
            #     f'Found a match in proteins entity lookup but token "{word}" is an exclusion.',  # noqa
            #     extra=EventLog(event_type='annotations').to_dict()
            # )
            return True
        return False

    def is_species_exclusion(self, word) -> bool:
        lowered = word.lower()
        if lowered in self.exclusion_type_species:
            # current_app.logger.info(
            #     f'Found a match in species entity lookup but token "{word}" is an exclusion.',  # noqa
            #     extra=EventLog(event_type='annotations').to_dict()
            # )
            return True
        elif lowered in SPECIES_EXCLUSION:
            # current_app.logger.info(
            #     f'Found a match in species entity lookup but token "{word}" is a stop word.',  # noqa
            #     extra=EventLog(event_type='annotations').to_dict()
            # )
            return True
        return False

    def is_company_exclusion(self, word) -> bool:
        lowered = word.lower()
        if lowered in self.exclusion_type_company:
            # current_app.logger.info(
            #     f'Found a match in company entity lookup but token "{word}" is an exclusion.',  # noqa
            #     extra=EventLog(event_type='annotations').to_dict()
            # )
            return True
        return False

    def is_entity_exclusion(self, word) -> bool:
        lowered = word.lower()
        if lowered in self.exclusion_type_entity:
            # current_app.logger.info(
            #     f'Found a match in entity lookup but token "{word}" is an exclusion.',  # noqa
            #     extra=EventLog(event_type='annotations').to_dict()
            # )
            return True
        return False

    def set_entity_exclusions(self) -> None:
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
                    extra=EventLog(event_type='annotations').to_dict()
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
        gene_ids = [i for i, _, _, _, _ in self.gene_collection]
        gene_names = self.graph.get_genes_from_gene_ids(gene_ids=gene_ids)

        current_app.logger.info(
            f'Failed to find a gene match in the knowledge graph for gene ids {set(gene_ids) - set(gene_names)}.',  # noqa
            extra=EventLog(event_type='annotations').to_dict()
        )

        for (gene_id, entity_id_type, entity_id_hyperlink, entity_name, normalized_name) in self.gene_collection:  # noqa
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

        for (entity_type, entity_id_str, inclusion, func) in inclusion_pairs:
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
        if not token.previous_words:
            return False

        if len(token.keyword) not in ABBREVIATION_WORD_LENGTH:
            return False

        if token.keyword not in self.abbreviations:
            abbrev = ''
            len_of_word = len(token.keyword)
            previous_words = token.previous_words.split(' ')
            for w in previous_words:
                if '-' in w:
                    split = w.split('-')
                    for w2 in split:
                        if w2:
                            abbrev += w2[0].upper()
                elif '/' in w:
                    split = w.split('/')
                    for w2 in split:
                        if w2:
                            abbrev += w2[0].upper()
                else:
                    abbrev += w[0].upper()
            abbrev = abbrev[-len_of_word:]

            if abbrev == token.keyword:
                self.abbreviations.add(token.keyword)

            return True if abbrev == token.keyword else False
        else:
            return True

    def generate_tokens(self, token: PDFWord, max_words) -> List[PDFWord]:
        num_words = 0
        current_token = token
        tokens_list = []
        while num_words < max_words:
            tokens_list.append(current_token)
            if not current_token.next:
                # reached end of text
                break
            current_token = current_token.next
            num_words += 1

        prev_token = None
        new_tokens = []

        for token in tokens_list:
            if prev_token is None:
                new_token = PDFWord(
                    keyword=token.keyword,
                    normalized_keyword=normalize_str(token.keyword),
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

                new_token = PDFWord(
                    keyword=curr_keyword,
                    normalized_keyword=normalize_str(curr_keyword),
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
                new_tokens.append(new_token)
                prev_token = new_token
        return new_tokens

    def identify_anatomy(
        self,
        token: PDFWord,
        anatomy_found: List[LMDBMatch],
        cursor
    ) -> None:
        current_token = token
        term = current_token.keyword
        lookup_term = current_token.normalized_keyword

        entities = None
        id_type = None
        id_hyperlink = None

        if cursor.set_key(lookup_term.encode('utf-8')):
            entities = [json.loads(v) for v in cursor.iternext_dup()]
        else:
            # didn't find in LMDB so look in global inclusion
            found = self.inclusion_type_anatomy.get(lookup_term, None)
            if found:
                entities = found.entities
                id_type = found.entity_id_type
                id_hyperlink = found.entity_id_hyperlink

        if entities:
            anatomy_found.append(
                LMDBMatch(
                    entities=entities,
                    token=current_token,
                    id_type=id_type or '',
                    id_hyperlink=id_hyperlink or ''
                )
            )

    def identify_chemical(
        self,
        token: PDFWord,
        chemicals_found: List[LMDBMatch],
        nlp_chemicals: Set[Tuple[int, int]],
        used_nlp: bool,
        cursor
    ) -> None:
        offset_key = (token.lo_location_offset, token.hi_location_offset)
        current_token = token
        term = current_token.keyword
        lookup_term = current_token.normalized_keyword

        entities = None
        id_type = None
        id_hyperlink = None

        found_inclusion = False

        if cursor.set_key(lookup_term.encode('utf-8')):
            entities = [json.loads(v) for v in cursor.iternext_dup()]
        else:
            # didn't find in LMDB so look in global inclusion
            found = self.inclusion_type_chemical.get(lookup_term, None)
            if found:
                found_inclusion = True
                entities = found.entities
                id_type = found.entity_id_type
                id_hyperlink = found.entity_id_hyperlink

        # only want those in inclusion or identified by NLP
        if entities:
            if not used_nlp:
                chemicals_found.append(
                    LMDBMatch(
                        entities=entities,
                        token=current_token,
                        id_type=id_type or '',
                        id_hyperlink=id_hyperlink or ''
                    )
                )
            elif found_inclusion or offset_key in nlp_chemicals:
                chemicals_found.append(
                    LMDBMatch(
                        entities=entities,
                        token=current_token,
                        id_type=id_type or '',
                        id_hyperlink=id_hyperlink or ''
                    )
                )

    def identify_compound(
        self,
        token: PDFWord,
        compounds_found: List[LMDBMatch],
        cursor
    ) -> None:
        current_token = token
        term = current_token.keyword
        lookup_term = current_token.normalized_keyword

        entities = None
        id_type = None
        id_hyperlink = None

        if cursor.set_key(lookup_term.encode('utf-8')):
            entities = [json.loads(v) for v in cursor.iternext_dup()]
        else:
            # didn't find in LMDB so look in global inclusion
            found = self.inclusion_type_compound.get(lookup_term, None)
            if found:
                entities = found.entities
                id_type = found.entity_id_type
                id_hyperlink = found.entity_id_hyperlink

        if entities:
            compounds_found.append(
                LMDBMatch(
                    entities=entities,
                    token=current_token,
                    id_type=id_type or '',
                    id_hyperlink=id_hyperlink or ''
                )
            )

    def identify_disease(
        self,
        token: PDFWord,
        diseases_found: List[LMDBMatch],
        nlp_diseases: Set[Tuple[int, int]],
        used_nlp: bool,
        cursor
    ) -> None:
        offset_key = (token.lo_location_offset, token.hi_location_offset)
        current_token = token
        term = current_token.keyword
        lookup_term = current_token.normalized_keyword

        entities = None
        id_type = None
        id_hyperlink = None

        found_inclusion = False

        if cursor.set_key(lookup_term.encode('utf-8')):
            entities = [json.loads(v) for v in cursor.iternext_dup()]
        else:
            # didn't find in LMDB so look in global inclusion
            found = self.inclusion_type_disease.get(lookup_term, None)
            if found:
                found_inclusion = True
                entities = found.entities
                id_type = found.entity_id_type
                id_hyperlink = found.entity_id_hyperlink

        # only want those in inclusion or identified by NLP (if any)
        if entities:
            if not used_nlp:
                diseases_found.append(
                    LMDBMatch(
                        entities=entities,
                        token=current_token,
                        id_type=id_type or '',
                        id_hyperlink=id_hyperlink or ''
                    )
                )
            elif found_inclusion or offset_key in nlp_diseases:
                diseases_found.append(
                    LMDBMatch(
                        entities=entities,
                        token=current_token,
                        id_type=id_type or '',
                        id_hyperlink=id_hyperlink or ''
                    )
                )

    def identify_food(
        self,
        token: PDFWord,
        foods_found: List[LMDBMatch],
        cursor
    ) -> None:
        current_token = token
        term = current_token.keyword
        lookup_term = current_token.normalized_keyword

        entities = None
        id_type = None
        id_hyperlink = None

        if cursor.set_key(lookup_term.encode('utf-8')):
            entities = [json.loads(v) for v in cursor.iternext_dup()]
        else:
            # didn't find in LMDB so look in global inclusion
            found = self.inclusion_type_food.get(lookup_term, None)
            if found:
                entities = found.entities
                id_type = found.entity_id_type
                id_hyperlink = found.entity_id_hyperlink

        if entities:
            foods_found.append(
                LMDBMatch(
                    entities=entities,
                    token=current_token,
                    id_type=id_type or '',
                    id_hyperlink=id_hyperlink or ''
                )
            )

    def identify_gene(
        self,
        token: PDFWord,
        genes_found: List[LMDBMatch],
        nlp_genes: Set[Tuple[int, int]],
        used_nlp: bool,
        cursor
    ) -> None:
        offset_key = (token.lo_location_offset, token.hi_location_offset)
        current_token = token
        term = current_token.keyword
        lookup_term = current_token.normalized_keyword

        entities = None
        id_type = None
        id_hyperlink = None

        found_inclusion = False

        if cursor.set_key(lookup_term.encode('utf-8')):
            entities = [json.loads(v) for v in cursor.iternext_dup()]
        else:
            # didn't find in LMDB so look in global inclusion
            found = self.inclusion_type_gene.get(lookup_term, None)
            if found:
                found_inclusion = True
                entities = found.entities
                id_type = found.entity_id_type
                id_hyperlink = found.entity_id_hyperlink

        # only want those in inclusion or identified by NLP (if any)
        if entities:
            if not used_nlp:
                genes_found.append(
                    LMDBMatch(
                        entities=entities,
                        token=current_token,
                        id_type=id_type or '',
                        id_hyperlink=id_hyperlink or ''
                    )
                )
            elif found_inclusion or offset_key in nlp_genes:
                genes_found.append(
                    LMDBMatch(
                        entities=entities,
                        token=current_token,
                        id_type=id_type or '',
                        id_hyperlink=id_hyperlink or ''
                    )
                )

    def identify_phenomena(
        self,
        token: PDFWord,
        phenomenas_found: List[LMDBMatch],
        cursor
    ) -> None:
        current_token = token
        term = current_token.keyword
        lookup_term = current_token.normalized_keyword

        entities = None
        id_type = None
        id_hyperlink = None

        if cursor.set_key(lookup_term.encode('utf-8')):
            entities = [json.loads(v) for v in cursor.iternext_dup()]
        else:
            # didn't find in LMDB so look in global inclusion
            found = self.inclusion_type_phenomena.get(lookup_term, None)
            if found:
                entities = found.entities
                id_type = found.entity_id_type
                id_hyperlink = found.entity_id_hyperlink

        if entities:
            phenomenas_found.append(
                LMDBMatch(
                    entities=entities,
                    token=current_token,
                    id_type=id_type or '',
                    id_hyperlink=id_hyperlink or ''
                )
            )

    def identify_phenotype(
        self,
        token: PDFWord,
        phenotypes_found: List[LMDBMatch],
        cursor
    ) -> None:
        current_token = token
        term = current_token.keyword
        lookup_term = current_token.normalized_keyword

        entities = None
        id_type = None
        id_hyperlink = None

        if cursor.set_key(lookup_term.encode('utf-8')):
            entities = [json.loads(v) for v in cursor.iternext_dup()]
        else:
            # didn't find in LMDB so look in global inclusion
            found = self.inclusion_type_phenotype.get(lookup_term, None)
            if found:
                entities = found.entities
                id_type = found.entity_id_type
                id_hyperlink = found.entity_id_hyperlink

        if entities:
            phenotypes_found.append(
                LMDBMatch(
                    entities=entities,
                    token=current_token,
                    id_type=id_type or '',
                    id_hyperlink=id_hyperlink or ''
                )
            )

    def identify_protein(
        self,
        token: PDFWord,
        proteins_found: List[LMDBMatch],
        cursor
    ) -> None:
        current_token = token
        term = current_token.keyword
        lookup_term = current_token.normalized_keyword

        entities = None
        id_type = None
        id_hyperlink = None

        if cursor.set_key(lookup_term.encode('utf-8')):
            entities = [json.loads(v) for v in cursor.iternext_dup()]
            entities_to_use = [entity for entity in entities if entity['synonym'] == term]  # noqa
            if entities_to_use:
                entities = entities_to_use
        else:
            # didn't find in LMDB so look in global inclusion
            found = self.inclusion_type_protein.get(lookup_term, None)
            if found:
                entities = found.entities
                id_type = found.entity_id_type
                id_hyperlink = found.entity_id_hyperlink

        if entities:
            proteins_found.append(
                LMDBMatch(
                    entities=entities,
                    token=current_token,
                    id_type=id_type or '',
                    id_hyperlink=id_hyperlink or ''
                )
            )

    def identify_species(
        self,
        token: PDFWord,
        species_found: List[LMDBMatch],
        species_local_found: List[LMDBMatch],
        cursor
    ) -> None:
        current_token = token
        term = current_token.keyword
        lookup_term = current_token.normalized_keyword

        entities = None
        id_type = None
        id_hyperlink = None

        if cursor.set_key(lookup_term.encode('utf-8')):
            entities = [json.loads(v) for v in cursor.iternext_dup()]
        else:
            # didn't find in LMDB so look in global inclusion
            found = self.inclusion_type_species.get(lookup_term, None)
            if found:
                entities = found.entities
                id_type = found.entity_id_type
                id_hyperlink = found.entity_id_hyperlink

        if entities:
            species_found.append(
                LMDBMatch(
                    entities=entities,
                    token=current_token,
                    id_type=id_type or '',
                    id_hyperlink=id_hyperlink or ''
                )
            )
        elif lookup_term in self.inclusion_type_species_local:
            try:
                entities = self.inclusion_type_species_local[lookup_term].entities
                id_type = self.inclusion_type_species_local[lookup_term].entity_id_type
                id_hyperlink = self.inclusion_type_species_local[lookup_term].entity_id_hyperlink  # noqa

                species_local_found.append(
                    LMDBMatch(
                        entities=entities,
                        token=current_token,
                        id_type=id_type,
                        id_hyperlink=id_hyperlink
                    )
                )
            except KeyError:
                current_app.logger.info(
                    f'Missing key attribute for local species inclusion.',
                    extra=EventLog(event_type='annotations').to_dict()
                )

    def identify(
        self,
        custom_annotations: List[dict],
        tokens: List[PDFWord],
        nlp_results: NLPResults,
        annotation_method: Dict[str, dict]
    ) -> EntityResults:
        self.set_entity_exclusions()
        self.set_entity_inclusions(custom_annotations)

        anatomy_cur = self.lmdb.session.anatomy_txn.cursor()
        chemicals_cur = self.lmdb.session.chemicals_txn.cursor()
        compounds_cur = self.lmdb.session.compounds_txn.cursor()
        diseases_cur = self.lmdb.session.diseases_txn.cursor()
        foods_cur = self.lmdb.session.foods_txn.cursor()
        genes_cur = self.lmdb.session.genes_txn.cursor()
        phenomenas_cur = self.lmdb.session.phenomenas_txn.cursor()
        phenotypes_cur = self.lmdb.session.phenotypes_txn.cursor()
        proteins_cur = self.lmdb.session.proteins_txn.cursor()
        species_cur = self.lmdb.session.species_txn.cursor()

        anatomy_found: List[LMDBMatch] = []
        chemicals_found: List[LMDBMatch] = []
        compounds_found: List[LMDBMatch] = []
        diseases_found: List[LMDBMatch] = []
        foods_found: List[LMDBMatch] = []
        genes_found: List[LMDBMatch] = []
        phenomenas_found: List[LMDBMatch] = []
        phenotypes_found: List[LMDBMatch] = []
        proteins_found: List[LMDBMatch] = []
        species_found: List[LMDBMatch] = []
        species_local_found: List[LMDBMatch] = []
        # non LMDB entities
        companies_found: List[LMDBMatch] = []
        entities_found: List[LMDBMatch] = []

        regex = re.compile(r'[\d{}]+$'.format(re.escape(punctuation)))

        for token in tokens:
            for current_token in self.generate_tokens(token, self.gene_max_words):
                if (current_token.keyword.lower() in COMMON_WORDS or
                    regex.match(current_token.keyword) or
                    current_token.keyword in ascii_letters or
                    current_token.keyword in digits or
                    len(current_token.normalized_keyword) <= 2 or
                    self.is_abbrev(current_token)
                ):  # noqa
                    continue

                if not self.is_gene_exclusion(current_token.keyword):
                    self.identify_gene(
                        token=current_token,
                        genes_found=genes_found,
                        nlp_genes=nlp_results.genes,
                        used_nlp=annotation_method.get(
                            EntityType.GENE.value, {}).get('nlp', False),
                        cursor=genes_cur)

            for current_token in self.generate_tokens(token, self.food_max_words):
                if (current_token.keyword.lower() in COMMON_WORDS or
                    regex.match(current_token.keyword) or
                    current_token.keyword in ascii_letters or
                    current_token.keyword in digits or
                    len(current_token.normalized_keyword) <= 2 or
                    self.is_abbrev(current_token)
                ):  # noqa
                    continue

                if not self.is_food_exclusion(current_token.keyword):
                    self.identify_food(
                        token=current_token, foods_found=foods_found, cursor=foods_cur)

            for current_token in self.generate_tokens(token, self.entity_max_words):
                if (current_token.keyword.lower() in COMMON_WORDS or
                    regex.match(current_token.keyword) or
                    current_token.keyword in ascii_letters or
                    current_token.keyword in digits or
                    len(current_token.normalized_keyword) <= 2 or
                    self.is_abbrev(current_token)
                ):  # noqa
                    continue

                if not self.is_anatomy_exclusion(current_token.keyword):
                    self.identify_anatomy(
                        token=current_token,
                        anatomy_found=anatomy_found,
                        cursor=anatomy_cur)

                if not self.is_chemical_exclusion(current_token.keyword):
                    self.identify_chemical(
                        token=current_token,
                        chemicals_found=chemicals_found,
                        nlp_chemicals=nlp_results.chemicals,
                        used_nlp=annotation_method.get(
                            EntityType.CHEMICAL.value, {}).get('nlp', False),
                        cursor=chemicals_cur)

                if not self.is_compound_exclusion(current_token.keyword):
                    self.identify_compound(
                        token=current_token,
                        compounds_found=compounds_found,
                        cursor=compounds_cur)

                if not self.is_disease_exclusion(current_token.keyword):
                    self.identify_disease(
                        token=current_token,
                        diseases_found=diseases_found,
                        nlp_diseases=nlp_results.diseases,
                        used_nlp=annotation_method.get(
                            EntityType.DISEASE.value, {}).get('nlp', False),
                        cursor=diseases_cur)

                if not self.is_phenomena_exclusion(current_token.keyword):
                    self.identify_phenomena(
                        token=current_token,
                        phenomenas_found=phenomenas_found,
                        cursor=phenomenas_cur)

                if not self.is_phenotype_exclusion(current_token.keyword):
                    self.identify_phenotype(
                        token=current_token,
                        phenotypes_found=phenotypes_found,
                        cursor=phenotypes_cur)

                if not self.is_protein_exclusion(current_token.keyword):
                    self.identify_protein(
                        token=current_token,
                        proteins_found=proteins_found,
                        cursor=proteins_cur)

                if not self.is_species_exclusion(current_token.keyword):
                    self.identify_species(
                        token=current_token,
                        species_found=species_found,
                        species_local_found=species_local_found,
                        cursor=species_cur)

                if not self.is_company_exclusion(current_token.keyword):
                    entities = None
                    id_type = None
                    id_hyperlink = None

                    found = self.inclusion_type_company.get(
                        current_token.normalized_keyword, None)
                    if found:
                        entities = found.entities
                        id_type = found.entity_id_type
                        id_hyperlink = found.entity_id_hyperlink

                    if entities:
                        companies_found.append(
                            LMDBMatch(
                                entities=entities,
                                token=current_token,
                                id_type=id_type or '',
                                id_hyperlink=id_hyperlink or ''
                            )
                        )

                if not self.is_entity_exclusion(current_token.keyword):
                    entities = None
                    id_type = None
                    id_hyperlink = None

                    found = self.inclusion_type_entity.get(
                        current_token.normalized_keyword, None)
                    if found:
                        entities = found.entities
                        id_type = found.entity_id_type
                        id_hyperlink = found.entity_id_hyperlink

                    if entities:
                        entities_found.append(
                            LMDBMatch(
                                entities=entities,
                                token=current_token,
                                id_type=id_type or '',
                                id_hyperlink=id_hyperlink or ''
                            )
                        )

        return EntityResults(
            matched_type_anatomy=anatomy_found,
            matched_type_chemical=chemicals_found,
            matched_type_compound=compounds_found,
            matched_type_disease=diseases_found,
            matched_type_food=foods_found,
            matched_type_gene=genes_found,
            matched_type_phenomena=phenomenas_found,
            matched_type_phenotype=phenotypes_found,
            matched_type_protein=proteins_found,
            matched_type_species=species_found,
            matched_type_species_local=species_local_found,
            # non LMDB entity types
            matched_type_company=companies_found,
            matched_type_entity=entities_found
        )
