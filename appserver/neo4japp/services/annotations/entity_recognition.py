import re

from collections import deque
from functools import partial
from itertools import starmap
from string import ascii_letters, digits, punctuation
from typing import Any, Dict, List, Optional, Set, Tuple

from flask import current_app
from sqlalchemy import and_

from neo4japp.exceptions import AnnotationError
from neo4japp.services.annotations import (
    AnnotationDBService,
    AnnotationGraphService
)
from neo4japp.services.annotations.constants import (
    ABBREVIATION_WORD_LENGTH,
    COMMON_TYPOS,
    COMMON_WORDS,
    SPACE_COORDINATE_FLOAT,
    SPECIES_EXCLUSION,
    EntityType,
    EntityIdStr,
    GREEK_SYMBOLS,
    ManualAnnotationType
)
from neo4japp.services.annotations.lmdb_service import LMDBService
from neo4japp.services.annotations.lmdb_util import (
    # TODO: move these into LMDBService
    create_ner_type_anatomy,
    create_ner_type_chemical,
    create_ner_type_compound,
    create_ner_type_disease,
    create_ner_type_food,
    create_ner_type_gene,
    create_ner_type_phenotype,
    create_ner_type_protein,
    create_ner_type_species,
    create_ner_type_company,
    create_ner_type_entity
)
from neo4japp.services.annotations.data_transfer_objects import (
    EntityResults,
    Inclusion,
    LMDBMatch,
    PDFMeta,
    PDFWord,
    PDFParsedContent,
    PDFTokensList
)
from neo4japp.models import AnnotationStopWords, GlobalList
from neo4japp.util import normalize_str
from neo4japp.utils.logger import EventLog


class EntityRecognitionService:
    def __init__(
        self,
        db: AnnotationDBService,
        graph: AnnotationGraphService,
        lmdb: LMDBService
    ) -> None:
        self.lmdb = lmdb
        self.graph = graph
        self.db = db
        self.greek_symbols = tuple([chr(g) for g in GREEK_SYMBOLS])

        # for inclusions, structured the same as LMDB
        self._inclusion_type_anatomy: Dict[str, Inclusion] = {}
        self._inclusion_type_chemical: Dict[str, Inclusion] = {}
        self._inclusion_type_compound: Dict[str, Inclusion] = {}
        self._inclusion_type_disease: Dict[str, Inclusion] = {}
        self._inclusion_type_food: Dict[str, Inclusion] = {}
        self._inclusion_type_gene: Dict[str, Inclusion] = {}
        self._inclusion_type_phenotype: Dict[str, Inclusion] = {}
        self._inclusion_type_protein: Dict[str, Inclusion] = {}
        self._inclusion_type_species: Dict[str, Inclusion] = {}
        self._inclusion_type_species_local: Dict[str, Inclusion] = {}

        # non LMDB entity types
        self._inclusion_type_company: Dict[str, Inclusion] = {}
        self._inclusion_type_entity: Dict[str, Inclusion] = {}

        self._exclusion_type_anatomy: Set[str] = set()
        self._exclusion_type_chemical: Set[str] = set()
        self._exclusion_type_compound: Set[str] = set()
        self._exclusion_type_disease: Set[str] = set()
        self._exclusion_type_food: Set[str] = set()
        self._exclusion_type_gene: Set[str] = set()
        self._exclusion_type_phenotype: Set[str] = set()
        self._exclusion_type_protein: Set[str] = set()
        self._exclusion_type_species: Set[str] = set()

        # non LMDB entity types
        self._exclusion_type_company: Set[str] = set()
        self._exclusion_type_entity: Set[str] = set()

        self._gene_collection: List[Tuple[str, str, str, str, str]] = []

        self._type_gene_case_insensitive_exclusion: Set[str] = set()
        self._type_protein_case_insensitive_exclusion: Set[str] = set()

        self._abbreviations: Set[str] = set()

        self._matched_type_anatomy: Dict[str, LMDBMatch] = {}
        self._matched_type_chemical: Dict[str, LMDBMatch] = {}
        self._matched_type_compound: Dict[str, LMDBMatch] = {}
        self._matched_type_disease: Dict[str, LMDBMatch] = {}
        self._matched_type_food: Dict[str, LMDBMatch] = {}
        self._matched_type_gene: Dict[str, LMDBMatch] = {}
        self._matched_type_protein: Dict[str, LMDBMatch] = {}
        self._matched_type_phenotype: Dict[str, LMDBMatch] = {}
        self._matched_type_species: Dict[str, LMDBMatch] = {}
        self._matched_type_species_local: Dict[str, LMDBMatch] = {}

        # non LMDB entity types
        self._matched_type_company: Dict[str, LMDBMatch] = {}
        self._matched_type_entity: Dict[str, LMDBMatch] = {}

        # TODO: could potentially put into a cache if these words will not be updated
        # often. But future feature will allow users to upload and add
        # to this list, so that means would have to recache.
        # leave as is for now?
        self.exclusion_words = set(
            result.word for result in self.db.session.query(
                AnnotationStopWords).all())

    @property
    def gene_collection(self) -> List[Tuple[str, str, str, str, str]]:
        return self._gene_collection

    @gene_collection.setter
    def gene_collection(self, gc):
        self._gene_collection = gc

    @property
    def type_gene_case_insensitive_exclusion(self) -> Set[str]:
        return self._type_gene_case_insensitive_exclusion

    @property
    def type_protein_case_insensitive_exclusion(self) -> Set[str]:
        return self._type_protein_case_insensitive_exclusion

    @property
    def abbreviations(self) -> Set[str]:
        return self._abbreviations

    @property
    def inclusion_type_anatomy(self) -> Dict[str, Inclusion]:
        return self._inclusion_type_anatomy

    @property
    def inclusion_type_chemical(self) -> Dict[str, Inclusion]:
        return self._inclusion_type_chemical

    @property
    def inclusion_type_compound(self) -> Dict[str, Inclusion]:
        return self._inclusion_type_compound

    @property
    def inclusion_type_disease(self) -> Dict[str, Inclusion]:
        return self._inclusion_type_disease

    @property
    def inclusion_type_food(self) -> Dict[str, Inclusion]:
        return self._inclusion_type_food

    @property
    def inclusion_type_gene(self) -> Dict[str, Inclusion]:
        return self._inclusion_type_gene

    @property
    def inclusion_type_phenotype(self) -> Dict[str, Inclusion]:
        return self._inclusion_type_phenotype

    @property
    def inclusion_type_protein(self) -> Dict[str, Inclusion]:
        return self._inclusion_type_protein

    @property
    def inclusion_type_species(self) -> Dict[str, Inclusion]:
        return self._inclusion_type_species

    @property
    def inclusion_type_species_local(self) -> Dict[str, Inclusion]:
        return self._inclusion_type_species_local

    @property
    def exclusion_type_anatomy(self) -> Set[str]:
        return self._exclusion_type_anatomy

    @property
    def exclusion_type_chemical(self) -> Set[str]:
        return self._exclusion_type_chemical

    @property
    def exclusion_type_compound(self) -> Set[str]:
        return self._exclusion_type_compound

    @property
    def exclusion_type_disease(self) -> Set[str]:
        return self._exclusion_type_disease

    @property
    def exclusion_type_food(self) -> Set[str]:
        return self._exclusion_type_food

    @property
    def exclusion_type_gene(self) -> Set[str]:
        return self._exclusion_type_gene

    @property
    def exclusion_type_phenotype(self) -> Set[str]:
        return self._exclusion_type_phenotype

    @property
    def exclusion_type_protein(self) -> Set[str]:
        return self._exclusion_type_protein

    @property
    def exclusion_type_species(self) -> Set[str]:
        return self._exclusion_type_species

    @property
    def matched_type_anatomy(self) -> Dict[str, LMDBMatch]:
        return self._matched_type_anatomy

    @property
    def matched_type_chemical(self) -> Dict[str, LMDBMatch]:
        return self._matched_type_chemical

    @property
    def matched_type_compound(self) -> Dict[str, LMDBMatch]:
        return self._matched_type_compound

    @property
    def matched_type_disease(self) -> Dict[str, LMDBMatch]:
        return self._matched_type_disease

    @property
    def matched_type_food(self) -> Dict[str, LMDBMatch]:
        return self._matched_type_food

    @property
    def matched_type_gene(self) -> Dict[str, LMDBMatch]:
        return self._matched_type_gene

    @property
    def matched_type_phenotype(self) -> Dict[str, LMDBMatch]:
        return self._matched_type_phenotype

    @property
    def matched_type_protein(self) -> Dict[str, LMDBMatch]:
        return self._matched_type_protein

    @property
    def matched_type_species(self) -> Dict[str, LMDBMatch]:
        return self._matched_type_species

    @property
    def matched_type_species_local(self) -> Dict[str, LMDBMatch]:
        return self._matched_type_species_local

    ##############################
    # start non LMDB entity types
    ##############################
    @property
    def inclusion_type_company(self) -> Dict[str, Inclusion]:
        return self._inclusion_type_company

    @property
    def inclusion_type_entity(self) -> Dict[str, Inclusion]:
        return self._inclusion_type_entity

    @property
    def exclusion_type_company(self) -> Set[str]:
        return self._exclusion_type_company

    @property
    def exclusion_type_entity(self) -> Set[str]:
        return self._exclusion_type_entity

    @property
    def matched_type_company(self) -> Dict[str, LMDBMatch]:
        return self._matched_type_company

    @property
    def matched_type_entity(self) -> Dict[str, LMDBMatch]:
        return self._matched_type_entity
    ############################
    # end non LMDB entity types
    ############################

    def get_entities_to_identify(
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
        # non LMDB entity types
        company: bool = True,
        entity: bool = True
    ) -> Dict[str, bool]:
        return {
            EntityType.ANATOMY.value: anatomy,
            EntityType.CHEMICAL.value: chemical,
            EntityType.COMPOUND.value: compound,
            EntityType.DISEASE.value: disease,
            EntityType.FOOD.value: food,
            EntityType.GENE.value: gene,
            EntityType.PHENOTYPE.value: phenotype,
            EntityType.PROTEIN.value: protein,
            EntityType.SPECIES.value: species,
            # non LMDB entity types
            EntityType.COMPANY.value: company,
            EntityType.ENTITY.value: entity
        }

    def get_entity_match_results(self) -> EntityResults:
        return EntityResults(
            matched_type_anatomy=self.matched_type_anatomy,
            matched_type_chemical=self.matched_type_chemical,
            matched_type_compound=self.matched_type_compound,
            matched_type_disease=self.matched_type_disease,
            matched_type_food=self.matched_type_food,
            matched_type_gene=self.matched_type_gene,
            matched_type_phenotype=self.matched_type_phenotype,
            matched_type_protein=self.matched_type_protein,
            matched_type_species=self.matched_type_species,
            matched_type_species_local=self.matched_type_species_local,
            # non LMDB entity types
            matched_type_company=self.matched_type_company,
            matched_type_entity=self.matched_type_entity
        )

    def _get_annotation_type_anatomy_to_exclude(
        self,
        exclusion_collection: Set[str],
        exclusion_list: List[dict]
    ):
        # case insensitive NOT punctuation insensitive
        for exclusion in exclusion_list:
            if exclusion.get('text') and exclusion.get('type') == EntityType.ANATOMY.value:
                exclusion_collection.add(exclusion.get('text').lower())  # type: ignore

    def _get_annotation_type_chemical_to_exclude(
        self,
        exclusion_collection: Set[str],
        exclusion_list: List[dict]
    ):
        # case insensitive NOT punctuation insensitive
        for exclusion in exclusion_list:
            if exclusion.get('text') and exclusion.get('type') == EntityType.CHEMICAL.value:
                exclusion_collection.add(exclusion.get('text').lower())  # type: ignore

    def _get_annotation_type_compound_to_exclude(
        self,
        exclusion_collection: Set[str],
        exclusion_list: List[dict]
    ):
        # case insensitive NOT punctuation insensitive
        for exclusion in exclusion_list:
            if exclusion.get('text') and exclusion.get('type') == EntityType.COMPOUND.value:
                exclusion_collection.add(exclusion.get('text').lower())  # type: ignore

    def _get_annotation_type_disease_to_exclude(
        self,
        exclusion_collection: Set[str],
        exclusion_list: List[dict]
    ):
        # case insensitive NOT punctuation insensitive
        for exclusion in exclusion_list:
            if exclusion.get('text') and exclusion.get('type') == EntityType.DISEASE.value:
                exclusion_collection.add(exclusion.get('text').lower())  # type: ignore

    def _get_annotation_type_food_to_exclude(
        self,
        exclusion_collection: Set[str],
        exclusion_list: List[dict]
    ):
        # case insensitive NOT punctuation insensitive
        for exclusion in exclusion_list:
            if exclusion.get('text') and exclusion.get('type') == EntityType.FOOD.value:
                exclusion_collection.add(exclusion.get('text').lower())  # type: ignore

    def _get_annotation_type_gene_to_exclude(
        self,
        exclusion_collection: Set[str],
        exclusion_list: List[dict]
    ):
        for exclusion in exclusion_list:
            if exclusion.get('text') and exclusion.get('type') == EntityType.GENE.value:
                term = exclusion.get('text')
                if exclusion.get('isCaseInsensitive'):
                    self.type_gene_case_insensitive_exclusion.add(term.lower())  # type: ignore
                    continue
                exclusion_collection.add(term)  # type: ignore

    def _get_annotation_type_phenotype_to_exclude(
        self,
        exclusion_collection: Set[str],
        exclusion_list: List[dict]
    ):
        # case insensitive NOT punctuation insensitive
        for exclusion in exclusion_list:
            if exclusion.get('text') and exclusion.get('type') == EntityType.PHENOTYPE.value:
                exclusion_collection.add(exclusion.get('text').lower())  # type: ignore

    def _get_annotation_type_protein_to_exclude(
        self,
        exclusion_collection: Set[str],
        exclusion_list: List[dict]
    ):
        for exclusion in exclusion_list:
            if exclusion.get('text') and exclusion.get('type') == EntityType.PROTEIN.value:
                term = exclusion.get('text')
                if exclusion.get('isCaseInsensitive'):
                    self.type_protein_case_insensitive_exclusion.add(term.lower())  # type: ignore
                    continue
                exclusion_collection.add(term)  # type: ignore

    def _get_annotation_type_species_to_exclude(
        self,
        exclusion_collection: Set[str],
        exclusion_list: List[dict]
    ):
        # case insensitive NOT punctuation insensitive
        for exclusion in exclusion_list:
            if exclusion.get('text') and exclusion.get('type') == EntityType.SPECIES.value:
                exclusion_collection.add(exclusion.get('text').lower())  # type: ignore

    def _get_annotation_type_company_to_exclude(
        self,
        exclusion_collection: Set[str],
        exclusion_list: List[dict]
    ):
        # case insensitive NOT punctuation insensitive
        for exclusion in exclusion_list:
            if exclusion.get('text') and exclusion.get('type') == EntityType.COMPANY.value:
                exclusion_collection.add(exclusion.get('text').lower())  # type: ignore

    def _get_annotation_type_entity_to_exclude(
        self,
        exclusion_collection: Set[str],
        exclusion_list: List[dict]
    ):
        # case insensitive NOT punctuation insensitive
        for exclusion in exclusion_list:
            if exclusion.get('text') and exclusion.get('type') == EntityType.ENTITY.value:
                exclusion_collection.add(exclusion.get('text').lower())  # type: ignore

    def _get_inclusion_pairs(self) -> List[Tuple[str, str, Any, Any]]:
        return [
            (EntityType.ANATOMY.value, EntityIdStr.ANATOMY.value, self.inclusion_type_anatomy, create_ner_type_anatomy),  # noqa
            (EntityType.CHEMICAL.value, EntityIdStr.CHEMICAL.value, self.inclusion_type_chemical, create_ner_type_chemical),  # noqa
            (EntityType.COMPOUND.value, EntityIdStr.COMPOUND.value, self.inclusion_type_compound, create_ner_type_compound),  # noqa
            (EntityType.DISEASE.value, EntityIdStr.DISEASE.value, self.inclusion_type_disease, create_ner_type_disease),  # noqa
            (EntityType.FOOD.value, EntityIdStr.FOOD.value, self.inclusion_type_food, create_ner_type_food),  # noqa
            (EntityType.GENE.value, EntityIdStr.GENE.value, self.inclusion_type_gene, create_ner_type_gene),  # noqa
            (EntityType.PHENOTYPE.value, EntityIdStr.PHENOTYPE.value, self.inclusion_type_phenotype, create_ner_type_phenotype),  # noqa
            (EntityType.PROTEIN.value, EntityIdStr.PROTEIN.value, self.inclusion_type_protein, create_ner_type_protein),  # noqa
            (EntityType.SPECIES.value, EntityIdStr.SPECIES.value, self.inclusion_type_species, create_ner_type_species),  # noqa
            # non LMDB entity types
            (EntityType.COMPANY.value, EntityIdStr.COMPANY.value, self.inclusion_type_company, create_ner_type_company),  # noqa
            (EntityType.ENTITY.value, EntityIdStr.ENTITY.value, self.inclusion_type_entity, create_ner_type_entity)  # noqa
        ]

    def _get_exclusion_pairs(self) -> List[Tuple[Set[str], Any]]:
        return [
            (self.exclusion_type_anatomy, self._get_annotation_type_anatomy_to_exclude),
            (self.exclusion_type_chemical, self._get_annotation_type_chemical_to_exclude),
            (self.exclusion_type_compound, self._get_annotation_type_compound_to_exclude),
            (self.exclusion_type_disease, self._get_annotation_type_disease_to_exclude),
            (self.exclusion_type_food, self._get_annotation_type_food_to_exclude),
            (self.exclusion_type_gene, self._get_annotation_type_gene_to_exclude),
            (self.exclusion_type_phenotype, self._get_annotation_type_phenotype_to_exclude),
            (self.exclusion_type_protein, self._get_annotation_type_protein_to_exclude),
            (self.exclusion_type_species, self._get_annotation_type_species_to_exclude),
            (self.exclusion_type_company, self._get_annotation_type_company_to_exclude),
            (self.exclusion_type_entity, self._get_annotation_type_entity_to_exclude)
        ]

    def _set_annotation_inclusions(
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
                    # currently ID is not a required input on the UI
                    # for some types
                    entity_id = entity_name

                # entity_name could be empty strings
                # probably a result of testing
                # but will keep here just in case
                if entity_id and entity_name and entity_type == entity_type_to_include:
                    entity = {}  # to avoid UnboundLocalError
                    if entity_type in {
                        EntityType.ANATOMY.value,
                        EntityType.CHEMICAL.value,
                        EntityType.COMPOUND.value,
                        EntityType.DISEASE.value,
                        EntityType.FOOD.value,
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
                                (entity_id, entity_id_type, entity_id_hyperlink, entity_name, normalized_entity_name))  # noqa
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

    def _is_abbrev(self, token: PDFWord) -> bool:
        """Determine if a word is an abbreviation.

        Start from closest word to abbreviation, and check the first character.
        """
        if not token.previous_words:
            return False

        if token.keyword not in self.abbreviations:
            if all([c.isupper() for c in token.keyword]) and len(token.keyword) in ABBREVIATION_WORD_LENGTH:  # noqa
                previous_words = token.previous_words.split(' ')
                abbrev = ''
                for word in reversed(previous_words):
                    if '-' in word or '/' in word:
                        word_split = []
                        if '-' in word:
                            word_split = word.split('-')
                        elif '/' in word:
                            word_split = word.split('/')

                        for split in reversed(word_split):
                            if len(abbrev) == len(token.keyword):
                                break
                            else:
                                if split:
                                    abbrev = split[0] + abbrev
                        if len(abbrev) == len(token.keyword):
                            break
                    else:
                        if word:
                            abbrev = word[0] + abbrev

                    if len(abbrev) == len(token.keyword):
                        break

                if abbrev.lower() != token.keyword.lower():
                    return False
                else:
                    # is an abbreviation so mark it as so
                    self.abbreviations.add(token.keyword)
                    return True
            else:
                return False
        else:
            return True

    def entity_lookup_for_type_anatomy(
        self,
        token: PDFWord,
        synonym: Optional[str] = None,
    ):
        """Do entity lookups for anatomy. First check in LMDB,
        if nothing was found, then check in global/local inclusions.

        Args:
            token: the token with pdf text and it's positions
            synonym: the correct spelling (if word is misspelled)
        """
        anatomy_val = None
        nlp_predicted_type = None

        if token.token_type:
            nlp_predicted_type = token.token_type

        if synonym:
            lookup_key = normalize_str(synonym)
        else:
            lookup_key = token.normalized_keyword

        if len(lookup_key) > 2:
            lowered_word = token.keyword.lower()

            if lowered_word in self.exclusion_type_anatomy:
                current_app.logger.info(
                    f'Found a match in anatomy entity lookup but token "{token.keyword}" is an exclusion.',  # noqa
                    extra=EventLog(event_type='annotations').to_dict()
                )
            elif lowered_word in self.exclusion_words:
                current_app.logger.info(
                    f'Found a match in anatomy entity lookup but token "{token.keyword}" is a stop word.',  # noqa
                    extra=EventLog(event_type='annotations').to_dict()
                )
            else:
                if self._is_abbrev(token):
                    return anatomy_val

                if nlp_predicted_type == EntityType.ANATOMY.value or nlp_predicted_type is None:  # noqa
                    anatomy_val = self.lmdb.get_lmdb_values(
                        txn=self.lmdb.session.anatomy_txn,
                        key=lookup_key,
                        token_type=EntityType.ANATOMY.value
                    )

                id_type = ''
                id_hyperlink = ''
                if not anatomy_val:
                    # didn't find in LMDB so look in global inclusion
                    found = self.inclusion_type_anatomy.get(lookup_key, None)
                    if found:
                        anatomy_val = found.entities
                        id_type = found.entity_id_type
                        id_hyperlink = found.entity_id_hyperlink

                if anatomy_val:
                    self.matched_type_anatomy[token.keyword] = LMDBMatch(
                        entities=anatomy_val,  # type: ignore
                        tokens=[token],
                        id_type=id_type,
                        id_hyperlink=id_hyperlink
                    )
        return anatomy_val

    def entity_lookup_for_type_chemical(
        self,
        token: PDFWord,
        synonym: Optional[str] = None,
    ):
        """Do entity lookups for chemical. First check in LMDB,
        if nothing was found, then check in global/local inclusions.

        Args:
            token: the token with pdf text and it's positions
            synonym: the correct spelling (if word is misspelled)
        """
        chem_val = None
        nlp_predicted_type = None

        if token.token_type:
            nlp_predicted_type = token.token_type

        if synonym:
            lookup_key = normalize_str(synonym)
        else:
            lookup_key = token.normalized_keyword

        if len(lookup_key) > 2:
            lowered_word = token.keyword.lower()

            if lowered_word in self.exclusion_type_chemical:
                current_app.logger.info(
                    f'Found a match in chemicals entity lookup but token "{token.keyword}" is an exclusion.',  # noqa
                    extra=EventLog(event_type='annotations').to_dict()
                )
            elif lowered_word in self.exclusion_words:
                current_app.logger.info(
                    f'Found a match in chemicals entity lookup but token "{token.keyword}" is a stop word.',  # noqa
                    extra=EventLog(event_type='annotations').to_dict()
                )
            else:
                if self._is_abbrev(token):
                    return chem_val

                if nlp_predicted_type == EntityType.CHEMICAL.value or nlp_predicted_type is None:  # noqa
                    chem_val = self.lmdb.get_lmdb_values(
                        txn=self.lmdb.session.chemicals_txn,
                        key=lookup_key,
                        token_type=EntityType.CHEMICAL.value
                    )

                id_type = ''
                id_hyperlink = ''
                if not chem_val:
                    # didn't find in LMDB so look in global inclusion
                    found = self.inclusion_type_chemical.get(lookup_key, None)
                    if found:
                        chem_val = found.entities
                        id_type = found.entity_id_type
                        id_hyperlink = found.entity_id_hyperlink

                if chem_val:
                    self.matched_type_chemical[token.keyword] = LMDBMatch(
                        entities=chem_val,  # type: ignore
                        tokens=[token],
                        id_type=id_type,
                        id_hyperlink=id_hyperlink
                    )
        return chem_val

    def entity_lookup_for_type_compound(
        self,
        token: PDFWord,
        synonym: Optional[str] = None,
    ):
        """Do entity lookups for compound. First check in LMDB,
        if nothing was found, then check in global/local inclusions.

        Args:
            token: the token with pdf text and it's positions
            synonym: the correct spelling (if word is misspelled)
        """
        comp_val = None
        nlp_predicted_type = None

        if token.token_type:
            nlp_predicted_type = token.token_type

        if synonym:
            lookup_key = normalize_str(synonym)
        else:
            lookup_key = token.normalized_keyword

        if len(lookup_key) > 2:
            lowered_word = token.keyword.lower()

            if lowered_word in self.exclusion_type_compound:
                current_app.logger.info(
                    f'Found a match in compounds entity lookup but token "{token.keyword}" is an exclusion.',  # noqa
                    extra=EventLog(event_type='annotations').to_dict()
                )
            elif lowered_word in self.exclusion_words:
                current_app.logger.info(
                    f'Found a match in compounds entity lookup but token "{token.keyword}" is a stop word.',  # noqa
                    extra=EventLog(event_type='annotations').to_dict()
                )
            else:
                if self._is_abbrev(token):
                    return comp_val

                if nlp_predicted_type == EntityType.COMPOUND.value or nlp_predicted_type is None:  # noqa
                    comp_val = self.lmdb.get_lmdb_values(
                        txn=self.lmdb.session.compounds_txn,
                        key=lookup_key,
                        token_type=EntityType.COMPOUND.value
                    )

                id_type = ''
                id_hyperlink = ''
                if not comp_val:
                    # didn't find in LMDB so look in global inclusion
                    found = self.inclusion_type_compound.get(lookup_key, None)
                    if found:
                        comp_val = found.entities
                        id_type = found.entity_id_type
                        id_hyperlink = found.entity_id_hyperlink

                if comp_val:
                    self.matched_type_compound[token.keyword] = LMDBMatch(
                        entities=comp_val,  # type: ignore
                        tokens=[token],
                        id_type=id_type,
                        id_hyperlink=id_hyperlink
                    )
        return comp_val

    def entity_lookup_for_type_disease(
        self,
        token: PDFWord,
        synonym: Optional[str] = None,
    ):
        """Do entity lookups for disease. First check in LMDB,
        if nothing was found, then check in global/local inclusions.

        Args:
            token: the token with pdf text and it's positions
            synonym: the correct spelling (if word is misspelled)
        """
        diseases_val = None
        nlp_predicted_type = None

        if token.token_type:
            nlp_predicted_type = token.token_type

        if synonym:
            lookup_key = normalize_str(synonym)
        else:
            lookup_key = token.normalized_keyword

        if len(lookup_key) > 2:
            lowered_word = token.keyword.lower()

            if lowered_word in self.exclusion_type_disease:
                current_app.logger.info(
                    f'Found a match in diseases entity lookup but token "{token.keyword}" is an exclusion.',  # noqa
                    extra=EventLog(event_type='annotations').to_dict()
                )
            elif lowered_word in self.exclusion_words:
                current_app.logger.info(
                    f'Found a match in diseases entity lookup but token "{token.keyword}" is a stop word.',  # noqa
                    extra=EventLog(event_type='annotations').to_dict()
                )
            else:
                if self._is_abbrev(token):
                    return diseases_val

                if nlp_predicted_type == EntityType.DISEASE.value or nlp_predicted_type is None:  # noqa
                    diseases_val = self.lmdb.get_lmdb_values(
                        txn=self.lmdb.session.diseases_txn,
                        key=lookup_key,
                        token_type=EntityType.DISEASE.value
                    )

                id_type = ''
                id_hyperlink = ''
                if not diseases_val:
                    # didn't find in LMDB so look in global inclusion
                    found = self.inclusion_type_disease.get(lookup_key, None)
                    if found:
                        diseases_val = found.entities
                        id_type = found.entity_id_type
                        id_hyperlink = found.entity_id_hyperlink

                if diseases_val:
                    self.matched_type_disease[token.keyword] = LMDBMatch(
                        entities=diseases_val,  # type: ignore
                        tokens=[token],
                        id_type=id_type,
                        id_hyperlink=id_hyperlink
                    )
        return diseases_val

    def entity_lookup_for_type_food(
        self,
        token: PDFWord,
        synonym: Optional[str] = None,
    ):
        """Do entity lookups for food. First check in LMDB,
        if nothing was found, then check in global/local inclusions.

        Args:
            token: the token with pdf text and it's positions
            synonym: the correct spelling (if word is misspelled)
        """
        food_val = None
        nlp_predicted_type = None

        if token.token_type:
            nlp_predicted_type = token.token_type

        if synonym:
            lookup_key = normalize_str(synonym)
        else:
            lookup_key = token.normalized_keyword

        if len(lookup_key) > 2:
            lowered_word = token.keyword.lower()

            if lowered_word in self.exclusion_type_food:
                current_app.logger.info(
                    f'Found a match in foods entity lookup but token "{token.keyword}" is an exclusion.',  # noqa
                    extra=EventLog(event_type='annotations').to_dict()
                )
            elif lowered_word in self.exclusion_words:
                current_app.logger.info(
                    f'Found a match in foods entity lookup but token "{token.keyword}" is a stop word.',  # noqa
                    extra=EventLog(event_type='annotations').to_dict()
                )
            else:
                if self._is_abbrev(token):
                    return food_val

                if nlp_predicted_type == EntityType.FOOD.value or nlp_predicted_type is None:  # noqa
                    food_val = self.lmdb.get_lmdb_values(
                        txn=self.lmdb.session.foods_txn,
                        key=lookup_key,
                        token_type=EntityType.FOOD.value
                    )

                id_type = ''
                id_hyperlink = ''
                if not food_val:
                    # didn't find in LMDB so look in global inclusion
                    found = self.inclusion_type_food.get(lookup_key, None)
                    if found:
                        food_val = found.entities
                        id_type = found.entity_id_type
                        id_hyperlink = found.entity_id_hyperlink

                if food_val:
                    self.matched_type_food[token.keyword] = LMDBMatch(
                        entities=food_val,  # type: ignore
                        tokens=[token],
                        id_type=id_type,
                        id_hyperlink=id_hyperlink
                    )
        return food_val

    def entity_lookup_for_type_gene(
        self,
        token: PDFWord,
        synonym: Optional[str] = None,
    ):
        """Do entity lookups for gene. First check in LMDB,
        if nothing was found, then check in global/local inclusions.

        Args:
            token: the token with pdf text and it's positions
            synonym: the correct spelling (if word is misspelled)
        """
        gene_val = None
        nlp_predicted_type = None

        if token.token_type:
            nlp_predicted_type = token.token_type

        if synonym:
            lookup_key = normalize_str(synonym)
        else:
            lookup_key = token.normalized_keyword

        if len(lookup_key) > 2:
            lowered_word = token.keyword.lower()

            # use token.keyword because case sensitive
            if lowered_word in self.type_gene_case_insensitive_exclusion or token.keyword in self.exclusion_type_gene:  # noqa
                current_app.logger.info(
                    f'Found a match in genes entity lookup but token "{token.keyword}" is an exclusion.',  # noqa
                    extra=EventLog(event_type='annotations').to_dict()
                )
            elif lowered_word in self.exclusion_words:
                current_app.logger.info(
                    f'Found a match in genes entity lookup but token "{token.keyword}" is a stop word.',  # noqa
                    extra=EventLog(event_type='annotations').to_dict()
                )
            else:
                if self._is_abbrev(token):
                    return gene_val

                if nlp_predicted_type == EntityType.GENE.value or nlp_predicted_type is None:  # noqa
                    gene_val = self.lmdb.get_lmdb_values(
                        txn=self.lmdb.session.genes_txn,
                        key=lookup_key,
                        token_type=EntityType.GENE.value
                    )

                id_type = ''
                id_hyperlink = ''
                if not gene_val:
                    # didn't find in LMDB so look in global inclusion
                    found = self.inclusion_type_gene.get(lookup_key, None)
                    if found:
                        gene_val = found.entities
                        id_type = found.entity_id_type
                        id_hyperlink = found.entity_id_hyperlink

                if gene_val:
                    self.matched_type_gene[token.keyword] = LMDBMatch(
                        entities=gene_val,  # type: ignore
                        tokens=[token],
                        id_type=id_type,
                        id_hyperlink=id_hyperlink
                    )
        return gene_val

    def entity_lookup_for_type_phenotype(
        self,
        token: PDFWord,
        synonym: Optional[str] = None,
    ):
        """Do entity lookups for phenotype. First check in LMDB,
        if nothing was found, then check in global/local inclusions.

        Args:
            token: the token with pdf text and it's positions
            synonym: the correct spelling (if word is misspelled)
        """
        phenotype_val = None
        nlp_predicted_type = None

        if token.token_type:
            nlp_predicted_type = token.token_type

        if synonym:
            lookup_key = normalize_str(synonym)
        else:
            lookup_key = token.normalized_keyword

        if len(lookup_key) > 2:
            lowered_word = token.keyword.lower()

            if lowered_word in self.exclusion_type_phenotype:
                current_app.logger.info(
                    f'Found a match in phenotypes entity lookup but token "{token.keyword}" is an exclusion.',  # noqa
                    extra=EventLog(event_type='annotations').to_dict()
                )
            elif lowered_word in self.exclusion_words:
                current_app.logger.info(
                    f'Found a match in phenotypes entity lookup but token "{token.keyword}" is a stop word.',  # noqa
                    extra=EventLog(event_type='annotations').to_dict()
                )
            else:
                if self._is_abbrev(token):
                    return phenotype_val

                if nlp_predicted_type == EntityType.PHENOTYPE.value or nlp_predicted_type is None:  # noqa
                    phenotype_val = self.lmdb.get_lmdb_values(
                        txn=self.lmdb.session.phenotypes_txn,
                        key=lookup_key,
                        token_type=EntityType.PHENOTYPE.value
                    )

                id_type = ''
                id_hyperlink = ''
                if not phenotype_val:
                    # didn't find in LMDB so look in global inclusion
                    found = self.inclusion_type_phenotype.get(lookup_key, None)
                    if found:
                        phenotype_val = found.entities
                        id_type = found.entity_id_type
                        id_hyperlink = found.entity_id_hyperlink

                if phenotype_val:
                    self.matched_type_phenotype[token.keyword] = LMDBMatch(
                        entities=phenotype_val,  # type: ignore
                        tokens=[token],
                        id_type=id_type,
                        id_hyperlink=id_hyperlink
                    )
        return phenotype_val

    def entity_lookup_for_type_protein(
        self,
        token: PDFWord,
        synonym: Optional[str] = None,
    ):
        """Do entity lookups for protein. First check in LMDB,
        if nothing was found, then check in global/local inclusions.

        Args:
            token: the token with pdf text and it's positions
            synonym: the correct spelling (if word is misspelled)
        """
        protein_val = None
        nlp_predicted_type = None

        if token.token_type:
            nlp_predicted_type = token.token_type

        if synonym:
            lookup_key = normalize_str(synonym)
        else:
            lookup_key = token.normalized_keyword

        if len(lookup_key) > 2:
            lowered_word = token.keyword.lower()

            # use token.keyword because case sensitive
            if lowered_word in self.type_protein_case_insensitive_exclusion or token.keyword in self.exclusion_type_protein:  # noqa
                current_app.logger.info(
                    f'Found a match in proteins entity lookup but token "{token.keyword}" is an exclusion.',  # noqa
                    extra=EventLog(event_type='annotations').to_dict()
                )
            elif lowered_word in self.exclusion_words:
                current_app.logger.info(
                    f'Found a match in proteins entity lookup but token "{token.keyword}" is a stop word.',  # noqa
                    extra=EventLog(event_type='annotations').to_dict()
                )
            else:
                if self._is_abbrev(token):
                    return protein_val

                if nlp_predicted_type == EntityType.PROTEIN.value or nlp_predicted_type is None:  # noqa
                    protein_val = self.lmdb.get_lmdb_values(
                        txn=self.lmdb.session.proteins_txn,
                        key=lookup_key,
                        token_type=EntityType.PROTEIN.value
                    )

                if protein_val:
                    entities_to_use = [entity for entity in protein_val if entity['synonym'] == token.keyword]  # noqa
                    if entities_to_use:
                        protein_val = entities_to_use

                id_type = ''
                id_hyperlink = ''
                if not protein_val:
                    # didn't find in LMDB so look in global inclusion
                    found = self.inclusion_type_protein.get(lookup_key, None)
                    if found:
                        protein_val = found.entities
                        id_type = found.entity_id_type
                        id_hyperlink = found.entity_id_hyperlink

                if protein_val:
                    self.matched_type_protein[token.keyword] = LMDBMatch(
                        entities=protein_val,  # type: ignore
                        tokens=[token],
                        id_type=id_type,
                        id_hyperlink=id_hyperlink
                    )
        return protein_val

    def entity_lookup_for_type_species(
        self,
        token: PDFWord,
        synonym: Optional[str] = None,
    ):
        """Do entity lookups for species. First check in LMDB,
        if nothing was found, then check in global/local inclusions.

        Args:
            token: the token with pdf text and it's positions
            synonym: the correct spelling (if word is misspelled)
        """
        species_val = None
        nlp_predicted_type = None

        if token.token_type:
            nlp_predicted_type = token.token_type

        if synonym:
            lookup_key = normalize_str(synonym)
        else:
            lookup_key = token.normalized_keyword

        if len(lookup_key) > 2:
            lowered_word = token.keyword.lower()

            if lowered_word in self.exclusion_type_species:
                current_app.logger.info(
                    f'Found a match in species entity lookup but token "{token.keyword}" is an exclusion.',  # noqa
                    extra=EventLog(event_type='annotations').to_dict()
                )
            elif lowered_word in SPECIES_EXCLUSION:
                current_app.logger.info(
                    f'Found a match in species entity lookup but token "{token.keyword}" is a stop word.',  # noqa
                    extra=EventLog(event_type='annotations').to_dict()
                )
            else:
                if self._is_abbrev(token):
                    return species_val

                # check species
                # TODO: Bacteria because for now NLP has that instead of
                # generic `Species`
                if nlp_predicted_type == EntityType.SPECIES.value or nlp_predicted_type == 'Bacteria':  # noqa
                    species_val = self.lmdb.get_lmdb_values(
                        txn=self.lmdb.session.species_txn,
                        key=lookup_key,
                        token_type=EntityType.SPECIES.value
                    )
                elif nlp_predicted_type is None:
                    species_val = self.lmdb.get_lmdb_values(
                        txn=self.lmdb.session.species_txn,
                        key=lookup_key,
                        token_type=EntityType.SPECIES.value
                    )

                id_type = ''
                id_hyperlink = ''
                if not species_val:
                    # didn't find in LMDB so look in global inclusion
                    found = self.inclusion_type_species.get(lookup_key, None)
                    if found:
                        species_val = found.entities
                        id_type = found.entity_id_type
                        id_hyperlink = found.entity_id_hyperlink

                if species_val:
                    self.matched_type_species[token.keyword] = LMDBMatch(
                        entities=species_val,  # type: ignore
                        tokens=[token],
                        id_type=id_type,
                        id_hyperlink=id_hyperlink
                    )
                elif lookup_key in self.inclusion_type_species_local:
                    try:
                        species_val = self.inclusion_type_species_local[lookup_key].entities
                        id_type = self.inclusion_type_species_local[lookup_key].entity_id_type
                        id_hyperlink = self.inclusion_type_species_local[lookup_key].entity_id_hyperlink  # noqa

                        self.matched_type_species_local[token.keyword] = LMDBMatch(
                            entities=species_val,  # type: ignore
                            tokens=[token],
                            id_type=id_type,
                            id_hyperlink=id_hyperlink
                        )
                    except KeyError:
                        raise AnnotationError('Missing key attribute for local species inclusion.')
        return species_val

    def entity_lookup_for_type_company(
        self,
        token: PDFWord,
        synonym: Optional[str] = None,
    ):
        """Do entity lookups for company, check only in
        global/local inclusions.

        Args:
            token: the token with pdf text and it's positions
            synonym: the correct spelling (if word is misspelled)
        """
        company_val = None

        if synonym:
            lookup_key = normalize_str(synonym)
        else:
            lookup_key = token.normalized_keyword

        if len(lookup_key) > 2:
            lowered_word = token.keyword.lower()

            if lowered_word in self.exclusion_type_company:
                current_app.logger.info(
                    f'Found a match in company entity lookup but token "{token.keyword}" is an exclusion.',  # noqa
                    extra=EventLog(event_type='annotations').to_dict()
                )
            elif lowered_word in self.exclusion_words:
                current_app.logger.info(
                    f'Found a match in company entity lookup but token "{token.keyword}" is a stop word.',  # noqa
                    extra=EventLog(event_type='annotations').to_dict()
                )
            else:
                if self._is_abbrev(token):
                    return company_val

                found = self.inclusion_type_company.get(lookup_key, None)
                if found:
                    company_val = found.entities
                    id_type = found.entity_id_type
                    id_hyperlink = found.entity_id_hyperlink

                if company_val:
                    self.matched_type_company[token.keyword] = LMDBMatch(
                        entities=company_val,  # type: ignore
                        tokens=[token],
                        id_type=id_type,
                        id_hyperlink=id_hyperlink
                    )
        return company_val

    def entity_lookup_for_type_entity(
        self,
        token: PDFWord,
        synonym: Optional[str] = None,
    ):
        """Do entity lookups for entity, check only in
        global/local inclusions.

        Args:
            token: the token with pdf text and it's positions
            synonym: the correct spelling (if word is misspelled)
        """
        entity_val = None

        if synonym:
            lookup_key = normalize_str(synonym)
        else:
            lookup_key = token.normalized_keyword

        if len(lookup_key) > 2:
            lowered_word = token.keyword.lower()

            if lowered_word in self.exclusion_type_entity:
                current_app.logger.info(
                    f'Found a match in entity lookup but token "{token.keyword}" is an exclusion.',  # noqa
                    extra=EventLog(event_type='annotations').to_dict()
                )
            elif lowered_word in self.exclusion_words:
                current_app.logger.info(
                    f'Found a match in entity lookup but token "{token.keyword}" is a stop word.',  # noqa
                    extra=EventLog(event_type='annotations').to_dict()
                )
            else:
                if self._is_abbrev(token):
                    return entity_val

                found = self.inclusion_type_entity.get(lookup_key, None)
                if found:
                    entity_val = found.entities
                    id_type = found.entity_id_type
                    id_hyperlink = found.entity_id_hyperlink

                if entity_val:
                    self.matched_type_entity[token.keyword] = LMDBMatch(
                        entities=entity_val,  # type: ignore
                        tokens=[token],
                        id_type=id_type,
                        id_hyperlink=id_hyperlink
                    )
        return entity_val

    def _entity_lookup_dispatch(
        self,
        token: PDFWord,
        check_entities: Dict[str, bool],
    ) -> None:
        if token.keyword.startswith(self.greek_symbols):
            meta = token.meta
            counter = 0
            for c in token.keyword:
                if c in self.greek_symbols:
                    counter += 1
                else:
                    break
            for i in range(0, counter):
                meta.coordinates.pop(i)
                meta.heights.pop(i)
                meta.widths.pop(i)

            new_token_keyword = token.keyword[counter:]
            token = PDFWord(
                keyword=new_token_keyword,
                normalized_keyword=normalize_str(new_token_keyword),
                page_number=token.page_number,
                cropbox=token.cropbox,
                meta=meta,
                previous_words=token.previous_words,
                token_type=token.token_type
            )

        if check_entities.get(EntityType.ANATOMY.value, False):
            if token.keyword in self.matched_type_anatomy:
                self.matched_type_anatomy[token.keyword].tokens.append(token)
            else:
                self._find_match_type_anatomy(token)

        if check_entities.get(EntityType.CHEMICAL.value, False):
            if token.keyword in self.matched_type_chemical:
                self.matched_type_chemical[token.keyword].tokens.append(token)
            else:
                self._find_match_type_chemical(token)

        if check_entities.get(EntityType.COMPOUND.value, False):
            if token.keyword in self.matched_type_compound:
                self.matched_type_compound[token.keyword].tokens.append(token)
            else:
                self._find_match_type_compound(token)

        if check_entities.get(EntityType.DISEASE.value, False):
            if token.keyword in self.matched_type_disease:
                self.matched_type_disease[token.keyword].tokens.append(token)
            else:
                self._find_match_type_disease(token)

        if check_entities.get(EntityType.FOOD.value, False):
            if token.keyword in self.matched_type_food:
                self.matched_type_food[token.keyword].tokens.append(token)
            else:
                self._find_match_type_food(token)

        if check_entities.get(EntityType.GENE.value, False):
            if token.keyword in self.matched_type_gene:
                self.matched_type_gene[token.keyword].tokens.append(token)
            else:
                self._find_match_type_gene(token)

        if check_entities.get(EntityType.PHENOTYPE.value, False):
            if token.keyword in self.matched_type_phenotype:
                self.matched_type_phenotype[token.keyword].tokens.append(token)
            else:
                self._find_match_type_phenotype(token)

        if check_entities.get(EntityType.PROTEIN.value, False):
            if token.keyword in self.matched_type_protein:
                self.matched_type_protein[token.keyword].tokens.append(token)
            else:
                self._find_match_type_protein(token)

        if check_entities.get(EntityType.SPECIES.value, False):
            if token.keyword in self.matched_type_species:
                self.matched_type_species[token.keyword].tokens.append(token)
            elif token.keyword in self.matched_type_species_local:
                self.matched_type_species_local[token.keyword].tokens.append(token)
            else:
                self._find_match_type_species(token)

        # non LMDB entity types
        if check_entities.get(EntityType.COMPANY.value, False):
            if token.keyword in self.matched_type_company:
                self.matched_type_company[token.keyword].tokens.append(token)
            else:
                self._find_match_type_company(token)

        if check_entities.get(EntityType.ENTITY.value, False):
            if token.keyword in self.matched_type_entity:
                self.matched_type_entity[token.keyword].tokens.append(token)
            else:
                self._find_match_type_entity(token)

    def _find_match_type_anatomy(self, token: PDFWord) -> None:
        word = token.keyword
        if word:
            if word in COMMON_TYPOS:
                for correct_spelling in COMMON_TYPOS[word]:
                    exist = self.entity_lookup_for_type_anatomy(
                        token=token,
                        synonym=correct_spelling
                    )

                    # if any that means there was a match
                    if exist is not None:
                        break
            else:
                self.entity_lookup_for_type_anatomy(
                    token=token
                )

    def _find_match_type_chemical(self, token: PDFWord) -> None:
        word = token.keyword
        if word:
            if word in COMMON_TYPOS:
                for correct_spelling in COMMON_TYPOS[word]:
                    exist = self.entity_lookup_for_type_chemical(
                        token=token,
                        synonym=correct_spelling
                    )

                    # if any that means there was a match
                    if exist is not None:
                        break
            else:
                self.entity_lookup_for_type_chemical(
                    token=token
                )

    def _find_match_type_compound(self, token: PDFWord) -> None:
        word = token.keyword
        if word:
            if word in COMMON_TYPOS:
                for correct_spelling in COMMON_TYPOS[word]:
                    exist = self.entity_lookup_for_type_compound(
                        token=token,
                        synonym=correct_spelling
                    )

                    # if any that means there was a match
                    if exist is not None:
                        break
            else:
                self.entity_lookup_for_type_compound(
                    token=token
                )

    def _find_match_type_disease(self, token: PDFWord) -> None:
        word = token.keyword
        if word:
            if word in COMMON_TYPOS:
                for correct_spelling in COMMON_TYPOS[word]:
                    exist = self.entity_lookup_for_type_disease(
                        token=token,
                        synonym=correct_spelling
                    )

                    # if any that means there was a match
                    if exist is not None:
                        break
            else:
                self.entity_lookup_for_type_disease(
                    token=token
                )

    def _find_match_type_food(self, token: PDFWord) -> None:
        word = token.keyword
        if word:
            if word in COMMON_TYPOS:
                for correct_spelling in COMMON_TYPOS[word]:
                    exist = self.entity_lookup_for_type_food(
                        token=token,
                        synonym=correct_spelling
                    )

                    # if any that means there was a match
                    if exist is not None:
                        break
            else:
                self.entity_lookup_for_type_food(
                    token=token
                )

    def _find_match_type_gene(self, token: PDFWord) -> None:
        word = token.keyword
        if word:
            if word in COMMON_TYPOS:
                for correct_spelling in COMMON_TYPOS[word]:
                    exist = self.entity_lookup_for_type_gene(
                        token=token,
                        synonym=correct_spelling
                    )

                    # if any that means there was a match
                    if exist is not None:
                        break
            else:
                self.entity_lookup_for_type_gene(
                    token=token
                )

    def _find_match_type_phenotype(self, token: PDFWord) -> None:
        word = token.keyword
        if word:
            if word in COMMON_TYPOS:
                for correct_spelling in COMMON_TYPOS[word]:
                    exist = self.entity_lookup_for_type_phenotype(
                        token=token,
                        synonym=correct_spelling
                    )

                    # if any that means there was a match
                    if exist is not None:
                        break
            else:
                self.entity_lookup_for_type_phenotype(
                    token=token
                )

    def _find_match_type_protein(self, token: PDFWord) -> None:
        word = token.keyword
        if word:
            if word in COMMON_TYPOS:
                for correct_spelling in COMMON_TYPOS[word]:
                    exist = self.entity_lookup_for_type_protein(
                        token=token,
                        synonym=correct_spelling
                    )

                    # if any that means there was a match
                    if exist is not None:
                        break
            else:
                self.entity_lookup_for_type_protein(
                    token=token
                )

    def _find_match_type_species(self, token: PDFWord) -> None:
        word = token.keyword
        if word:
            if word in COMMON_TYPOS:
                for correct_spelling in COMMON_TYPOS[word]:
                    exist = self.entity_lookup_for_type_species(
                        token=token,
                        synonym=correct_spelling
                    )

                    # if any that means there was a match
                    if exist is not None:
                        break
            else:
                self.entity_lookup_for_type_species(
                    token=token
                )

    def _find_match_type_company(self, token: PDFWord) -> None:
        word = token.keyword
        if word:
            self.entity_lookup_for_type_company(token=token)

    def _find_match_type_entity(self, token: PDFWord) -> None:
        word = token.keyword
        if word:
            self.entity_lookup_for_type_entity(
                token=token
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
        gene_names = self.graph.get_genes_from_gene_ids(
            gene_ids=gene_ids)

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
        deque(starmap(
            self._set_annotation_inclusions,
            [
                (
                    global_annotations_to_include,
                    entity_type,
                    entity_id_str,
                    inclusion,
                    func
                ) for entity_type, entity_id_str, inclusion, func in self._get_inclusion_pairs()
            ]), maxlen=0)
        self._query_genes_from_kg(self.inclusion_type_gene)

        # local inclusions
        deque(starmap(
            self._set_annotation_inclusions,
            [
                (
                    # only get the custom species for now
                    [
                        custom for custom in custom_annotations if custom.get(
                            'meta', {}).get('type') == EntityType.SPECIES.value and not custom.get(
                                'meta', {}).get('includeGlobally')],
                    EntityType.SPECIES.value,
                    EntityIdStr.SPECIES.value,
                    self.inclusion_type_species_local,
                    create_ner_type_species
                )
            ]), maxlen=0)

    def set_entity_exclusions(self) -> None:
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
        deque(starmap(
            lambda to_exclude, exclude_collection, func: func(exclude_collection, to_exclude),
            [
                (
                    global_annotations_to_exclude,
                    exclusion,
                    func
                ) for exclusion, func in self._get_exclusion_pairs()]), maxlen=0)

    def identify_entities(
        self,
        tokens: List[PDFWord],
        check_entities_in_lmdb: Dict[str, bool],
    ) -> None:
        deque(map(partial(
            self._entity_lookup_dispatch,
            check_entities=check_entities_in_lmdb), tokens), maxlen=0)

    def _combine_sequential_words(self, words, compiled_regex):
        """Generator that combines a list of words into sequentially increment words.

        E.g ['A', 'B', 'C', 'D', 'E'] -> ['A', 'A B', 'A B C', 'B', 'B C', ...]
            - NOTE: each character here represents a word
        """
        processed_tokens: Set[str] = set()

        # TODO: go into constants.py if used by other classes
        max_word_length = 6
        end_idx = curr_max_words = 1
        max_length = len(words)

        # now create keyword tokens up to max_word_length
        for i, _ in enumerate(words):
            while curr_max_words <= max_word_length and end_idx <= max_length:  # noqa
                words_subset = words[i:end_idx]
                curr_keyword = ''
                coordinates = []
                heights = []
                widths = []

                for word in words_subset:
                    curr_keyword += word.keyword
                    coordinates += word.meta.coordinates
                    heights += word.meta.heights
                    widths += word.meta.widths

                    # space
                    curr_keyword += ' '
                    coordinates += [SPACE_COORDINATE_FLOAT]
                    heights += [SPACE_COORDINATE_FLOAT]
                    widths += [SPACE_COORDINATE_FLOAT]

                # remove trailing space
                curr_keyword = curr_keyword[:-1]
                coordinates = coordinates[:-1]
                heights = heights[:-1]
                widths = widths[:-1]

                if (curr_keyword.lower() not in COMMON_WORDS and
                    not compiled_regex.match(curr_keyword) and
                    curr_keyword not in ascii_letters and
                    curr_keyword not in digits):  # noqa

                    token = PDFWord(
                        keyword=curr_keyword,
                        normalized_keyword=normalize_str(curr_keyword),
                        # take the page of the first word
                        # if multi-word, consider it as part
                        # of page of first word
                        page_number=words_subset[0].page_number,
                        cropbox=words_subset[0].cropbox,
                        meta=PDFMeta(
                            lo_location_offset=words_subset[0].meta.lo_location_offset,
                            hi_location_offset=words_subset[-1].meta.hi_location_offset,
                            coordinates=coordinates,
                            heights=heights,
                            widths=widths
                        ),
                        previous_words=words_subset[0].previous_words
                    )
                    yield token

                curr_max_words += 1
                end_idx += 1
            curr_max_words = 1
            end_idx = i + 2

    def extract_tokens(self, parsed: PDFParsedContent) -> PDFTokensList:
        """Extract word tokens from the parsed characters.

        Returns a token list of sequentially concatentated.
        """
        # regex to check for digits with punctuation
        compiled_regex = re.compile(r'[\d{}]+$'.format(re.escape(punctuation)))

        return PDFTokensList(
            tokens=self._combine_sequential_words(
                words=parsed.words,
                compiled_regex=compiled_regex,
            )
        )
