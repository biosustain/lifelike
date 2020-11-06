from collections import deque
from functools import partial
from itertools import starmap
from typing import Any, Dict, List, Optional, Set, Tuple

from flask import current_app
from sqlalchemy import and_

from neo4japp.services.annotations.annotations_neo4j_service import AnnotationsNeo4jService
from neo4japp.services.annotations.constants import (
    COMMON_TYPOS,
    EntityType,
    EntityIdStr,
    ManualAnnotationType,
    SPECIES_EXCLUSION
)
from neo4japp.services.annotations.lmdb_dao import LMDBDao
from neo4japp.services.annotations.lmdb_util import (
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
from neo4japp.services.annotations.util import normalize_str

from neo4japp.data_transfer_objects import (
    EntityResults,
    LMDBMatch,
    PDFTokenPositions,
)
from neo4japp.models import AnnotationStopWords, GlobalList
from neo4japp.utils.logger import EventLog


class EntityRecognitionService:
    def __init__(
        self,
        annotation_neo4j: AnnotationsNeo4jService,
        lmdb_session: LMDBDao
    ) -> None:
        self.lmdb_session = lmdb_session
        self.annotation_neo4j = annotation_neo4j

        # for inclusions, structured the same as LMDB
        self._inclusion_type_anatomy: Dict[str, List[dict]] = {}
        self._inclusion_type_chemical: Dict[str, List[dict]] = {}
        self._inclusion_type_compound: Dict[str, List[dict]] = {}
        self._inclusion_type_disease: Dict[str, List[dict]] = {}
        self._inclusion_type_food: Dict[str, List[dict]] = {}
        self._inclusion_type_gene: Dict[str, List[dict]] = {}
        self._inclusion_type_phenotype: Dict[str, List[dict]] = {}
        self._inclusion_type_protein: Dict[str, List[dict]] = {}
        self._inclusion_type_species: Dict[str, List[dict]] = {}

        # non LMDB entity types
        self._inclusion_type_company: Dict[str, List[dict]] = {}
        self._inclusion_type_entity: Dict[str, List[dict]] = {}

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

        self._gene_collection: List[Tuple[str, str, str]] = []

        self._type_gene_case_insensitive_exclusion: Set[str] = set()
        self._type_protein_case_insensitive_exclusion: Set[str] = set()

        self._matched_type_anatomy: Dict[str, LMDBMatch] = {}
        self._matched_type_chemical: Dict[str, LMDBMatch] = {}
        self._matched_type_compound: Dict[str, LMDBMatch] = {}
        self._matched_type_disease: Dict[str, LMDBMatch] = {}
        self._matched_type_food: Dict[str, LMDBMatch] = {}
        self._matched_type_gene: Dict[str, LMDBMatch] = {}
        self._matched_type_protein: Dict[str, LMDBMatch] = {}
        self._matched_type_phenotype: Dict[str, LMDBMatch] = {}
        self._matched_type_species: Dict[str, LMDBMatch] = {}

        # non LMDB entity types
        self._matched_type_company: Dict[str, LMDBMatch] = {}
        self._matched_type_entity: Dict[str, LMDBMatch] = {}

        # TODO: could potentially put into a cache if these words will not be updated
        # often. But future feature will allow users to upload and add
        # to this list, so that means would have to recache.
        # leave as is for now?
        self.exclusion_words = set(
            result.word for result in self.annotation_neo4j.session.query(
                AnnotationStopWords).all())

    @property
    def gene_collection(self) -> List[Tuple[str, str, str]]:
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
    def inclusion_type_anatomy(self) -> Dict[str, List[dict]]:
        return self._inclusion_type_anatomy

    @property
    def inclusion_type_chemical(self) -> Dict[str, List[dict]]:
        return self._inclusion_type_chemical

    @property
    def inclusion_type_compound(self) -> Dict[str, List[dict]]:
        return self._inclusion_type_compound

    @property
    def inclusion_type_disease(self) -> Dict[str, List[dict]]:
        return self._inclusion_type_disease

    @property
    def inclusion_type_food(self) -> Dict[str, List[dict]]:
        return self._inclusion_type_food

    @property
    def inclusion_type_gene(self) -> Dict[str, List[dict]]:
        return self._inclusion_type_gene

    @property
    def inclusion_type_phenotype(self) -> Dict[str, List[dict]]:
        return self._inclusion_type_phenotype

    @property
    def inclusion_type_protein(self) -> Dict[str, List[dict]]:
        return self._inclusion_type_protein

    @property
    def inclusion_type_species(self) -> Dict[str, List[dict]]:
        return self._inclusion_type_species

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

    ##############################
    # start non LMDB entity types
    ##############################
    @property
    def inclusion_type_company(self) -> Dict[str, List[dict]]:
        return self._inclusion_type_company

    @property
    def inclusion_type_entity(self) -> Dict[str, List[dict]]:
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
        inclusion_collection: Dict[str, List[dict]],
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
            except KeyError:
                current_app.logger.info(
                    f'Error creating annotation inclusion {inclusion} for entity type {entity_type}',  # noqa
                    extra=EventLog(event_type='annotations').to_dict()
                )
            else:
                normalized_entity_name = normalize_str(entity_name)

                if entity_type in {EntityType.COMPANY.value, EntityType.ENTITY.value}:
                    # currently ID is not a required input on the UI
                    entity_id = entity_name

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
                                (entity_id, entity_name, normalized_entity_name))
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
                        inclusion_collection[normalized_entity_name].append(entity)
                    else:
                        inclusion_collection[normalized_entity_name] = [entity]

    def entity_lookup_for_type_anatomy(
        self,
        token: PDFTokenPositions,
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
                if nlp_predicted_type == EntityType.ANATOMY.value or nlp_predicted_type is None:  # noqa
                    anatomy_val = self.lmdb_session.get_lmdb_values(
                        txn=self.lmdb_session.anatomy_txn,
                        key=lookup_key,
                        token_type=EntityType.ANATOMY.value
                    )

                if not anatomy_val:
                    # didn't find in LMDB so look in global/local inclusion
                    anatomy_val = self.inclusion_type_anatomy.get(lookup_key, [])

                if anatomy_val:
                    if token.keyword in self.matched_type_anatomy:
                        self.matched_type_anatomy[token.keyword].tokens.append(token)
                    else:
                        self.matched_type_anatomy[token.keyword] = LMDBMatch(
                            entities=anatomy_val,  # type: ignore
                            tokens=[token]
                        )
        return anatomy_val

    def entity_lookup_for_type_chemical(
        self,
        token: PDFTokenPositions,
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
                if nlp_predicted_type == EntityType.CHEMICAL.value or nlp_predicted_type is None:  # noqa
                    chem_val = self.lmdb_session.get_lmdb_values(
                        txn=self.lmdb_session.chemicals_txn,
                        key=lookup_key,
                        token_type=EntityType.CHEMICAL.value
                    )

                if not chem_val:
                    # didn't find in LMDB so look in global/local inclusion
                    chem_val = self.inclusion_type_chemical.get(lookup_key, [])

                if chem_val:
                    if token.keyword in self.matched_type_chemical:
                        self.matched_type_chemical[token.keyword].tokens.append(token)
                    else:
                        self.matched_type_chemical[token.keyword] = LMDBMatch(
                            entities=chem_val,  # type: ignore
                            tokens=[token]
                        )
        return chem_val

    def entity_lookup_for_type_compound(
        self,
        token: PDFTokenPositions,
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
                if nlp_predicted_type == EntityType.COMPOUND.value or nlp_predicted_type is None:  # noqa
                    comp_val = self.lmdb_session.get_lmdb_values(
                        txn=self.lmdb_session.compounds_txn,
                        key=lookup_key,
                        token_type=EntityType.COMPOUND.value
                    )

                if not comp_val:
                    # didn't find in LMDB so look in global/local inclusion
                    comp_val = self.inclusion_type_compound.get(lookup_key, [])

                if comp_val:
                    if token.keyword in self.matched_type_compound:
                        self.matched_type_compound[token.keyword].tokens.append(token)
                    else:
                        self.matched_type_compound[token.keyword] = LMDBMatch(
                            entities=comp_val,  # type: ignore
                            tokens=[token]
                        )
        return comp_val

    def entity_lookup_for_type_disease(
        self,
        token: PDFTokenPositions,
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
                if nlp_predicted_type == EntityType.DISEASE.value or nlp_predicted_type is None:  # noqa
                    diseases_val = self.lmdb_session.get_lmdb_values(
                        txn=self.lmdb_session.diseases_txn,
                        key=lookup_key,
                        token_type=EntityType.DISEASE.value
                    )

                if not diseases_val:
                    # didn't find in LMDB so look in global/local inclusion
                    diseases_val = self.inclusion_type_disease.get(lookup_key, [])

                if diseases_val:
                    if token.keyword in self.matched_type_disease:
                        self.matched_type_disease[token.keyword].tokens.append(token)
                    else:
                        self.matched_type_disease[token.keyword] = LMDBMatch(
                            entities=diseases_val,  # type: ignore
                            tokens=[token]
                        )
        return diseases_val

    def entity_lookup_for_type_food(
        self,
        token: PDFTokenPositions,
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
                if nlp_predicted_type == EntityType.FOOD.value or nlp_predicted_type is None:  # noqa
                    food_val = self.lmdb_session.get_lmdb_values(
                        txn=self.lmdb_session.foods_txn,
                        key=lookup_key,
                        token_type=EntityType.FOOD.value
                    )

                if not food_val:
                    # didn't find in LMDB so look in global/local inclusion
                    food_val = self.inclusion_type_food.get(lookup_key, [])

                if food_val:
                    if token.keyword in self.matched_type_food:
                        self.matched_type_food[token.keyword].tokens.append(token)
                    else:
                        self.matched_type_food[token.keyword] = LMDBMatch(
                            entities=food_val,  # type: ignore
                            tokens=[token]
                        )
        return food_val

    def entity_lookup_for_type_gene(
        self,
        token: PDFTokenPositions,
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
                if nlp_predicted_type == EntityType.GENE.value or nlp_predicted_type is None:  # noqa
                    gene_val = self.lmdb_session.get_lmdb_values(
                        txn=self.lmdb_session.genes_txn,
                        key=lookup_key,
                        token_type=EntityType.GENE.value
                    )

                if not gene_val:
                    # didn't find in LMDB so look in global/local inclusion
                    gene_val = self.inclusion_type_gene.get(lookup_key, [])

                if gene_val:
                    if token.keyword in self.matched_type_gene:
                        self.matched_type_gene[token.keyword].tokens.append(token)
                    else:
                        self.matched_type_gene[token.keyword] = LMDBMatch(
                            entities=gene_val,  # type: ignore
                            tokens=[token]
                        )
        return gene_val

    def entity_lookup_for_type_phenotype(
        self,
        token: PDFTokenPositions,
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
                if nlp_predicted_type == EntityType.PHENOTYPE.value or nlp_predicted_type is None:  # noqa
                    phenotype_val = self.lmdb_session.get_lmdb_values(
                        txn=self.lmdb_session.phenotypes_txn,
                        key=lookup_key,
                        token_type=EntityType.PHENOTYPE.value
                    )

                if not phenotype_val:
                    # didn't find in LMDB so look in global/local inclusion
                    phenotype_val = self.inclusion_type_phenotype.get(lookup_key, [])

                if phenotype_val:
                    if token.keyword in self.matched_type_phenotype:
                        self.matched_type_phenotype[token.keyword].tokens.append(token)
                    else:
                        self.matched_type_phenotype[token.keyword] = LMDBMatch(
                            entities=phenotype_val,  # type: ignore
                            tokens=[token]
                        )
        return phenotype_val

    def entity_lookup_for_type_protein(
        self,
        token: PDFTokenPositions,
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
                if nlp_predicted_type == EntityType.PROTEIN.value or nlp_predicted_type is None:  # noqa
                    protein_val = self.lmdb_session.get_lmdb_values(
                        txn=self.lmdb_session.proteins_txn,
                        key=lookup_key,
                        token_type=EntityType.PROTEIN.value
                    )

                if protein_val:
                    entities_to_use = [entity for entity in protein_val if entity['synonym'] == token.keyword]  # noqa
                    if entities_to_use:
                        protein_val = entities_to_use

                if not protein_val:
                    # didn't find in LMDB so look in global/local inclusion
                    protein_val = self.inclusion_type_protein.get(lookup_key, [])

                if protein_val:
                    if token.keyword in self.matched_type_protein:
                        self.matched_type_protein[token.keyword].tokens.append(token)
                    else:
                        self.matched_type_protein[token.keyword] = LMDBMatch(
                            entities=protein_val,  # type: ignore
                            tokens=[token]
                        )
        return protein_val

    def entity_lookup_for_type_species(
        self,
        token: PDFTokenPositions,
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
                # check species
                # TODO: Bacteria because for now NLP has that instead of
                # generic `Species`
                if nlp_predicted_type == EntityType.SPECIES.value or nlp_predicted_type == 'Bacteria':  # noqa
                    species_val = self.lmdb_session.get_lmdb_values(
                        txn=self.lmdb_session.species_txn,
                        key=lookup_key,
                        token_type=EntityType.SPECIES.value
                    )
                elif nlp_predicted_type is None:
                    species_val = self.lmdb_session.get_lmdb_values(
                        txn=self.lmdb_session.species_txn,
                        key=lookup_key,
                        token_type=EntityType.SPECIES.value
                    )

                if not species_val:
                    # didn't find in LMDB so look in global/local inclusion
                    species_val = self.inclusion_type_species.get(lookup_key, [])

                if species_val:
                    if token.keyword in self.matched_type_species:
                        self.matched_type_species[token.keyword].tokens.append(token)
                    else:
                        self.matched_type_species[token.keyword] = LMDBMatch(
                            entities=species_val,  # type: ignore
                            tokens=[token]
                        )
        return species_val

    def entity_lookup_for_type_company(
        self,
        token: PDFTokenPositions,
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
                company_val = self.inclusion_type_company.get(lookup_key, [])

                if company_val:
                    if token.keyword in self.matched_type_company:
                        self.matched_type_company[token.keyword].tokens.append(token)
                    else:
                        self.matched_type_company[token.keyword] = LMDBMatch(
                            entities=company_val,  # type: ignore
                            tokens=[token]
                        )
        return company_val

    def entity_lookup_for_type_entity(
        self,
        token: PDFTokenPositions,
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
                entity_val = self.inclusion_type_entity.get(lookup_key, [])

                if entity_val:
                    if token.keyword in self.matched_type_entity:
                        self.matched_type_entity[token.keyword].tokens.append(token)
                    else:
                        self.matched_type_entity[token.keyword] = LMDBMatch(
                            entities=entity_val,  # type: ignore
                            tokens=[token]
                        )
        return entity_val

    def _entity_lookup_dispatch(
        self,
        token: PDFTokenPositions,
        check_entities: Dict[str, bool],
    ) -> None:
        if check_entities.get(EntityType.ANATOMY.value, False):
            self._find_match_type_anatomy(token)

        if check_entities.get(EntityType.CHEMICAL.value, False):
            self._find_match_type_chemical(token)

        if check_entities.get(EntityType.COMPOUND.value, False):
            self._find_match_type_compound(token)

        if check_entities.get(EntityType.DISEASE.value, False):
            self._find_match_type_disease(token)

        if check_entities.get(EntityType.FOOD.value, False):
            self._find_match_type_food(token)

        if check_entities.get(EntityType.GENE.value, False):
            self._find_match_type_gene(token)

        if check_entities.get(EntityType.PHENOTYPE.value, False):
            self._find_match_type_phenotype(token)

        if check_entities.get(EntityType.PROTEIN.value, False):
            self._find_match_type_protein(token)

        if check_entities.get(EntityType.SPECIES.value, False):
            self._find_match_type_species(token)

        # non LMDB entity types
        if check_entities.get(EntityType.COMPANY.value, False):
            self._find_match_type_company(token)

        if check_entities.get(EntityType.ENTITY.value, False):
            self._find_match_type_entity(token)

    def _find_match_type_anatomy(self, token: PDFTokenPositions) -> None:
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

    def _find_match_type_chemical(self, token: PDFTokenPositions) -> None:
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

    def _find_match_type_compound(self, token: PDFTokenPositions) -> None:
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

    def _find_match_type_disease(self, token: PDFTokenPositions) -> None:
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

    def _find_match_type_food(self, token: PDFTokenPositions) -> None:
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

    def _find_match_type_gene(self, token: PDFTokenPositions) -> None:
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

    def _find_match_type_phenotype(self, token: PDFTokenPositions) -> None:
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

    def _find_match_type_protein(self, token: PDFTokenPositions) -> None:
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

    def _find_match_type_species(self, token: PDFTokenPositions) -> None:
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

    def _find_match_type_company(self, token: PDFTokenPositions) -> None:
        word = token.keyword
        if word:
            self.entity_lookup_for_type_company(token=token)

    def _find_match_type_entity(self, token: PDFTokenPositions) -> None:
        word = token.keyword
        if word:
            self.entity_lookup_for_type_entity(
                token=token
            )

    def _query_genes_from_kg(
        self,
        gene_inclusion: Dict[str, List[dict]]
    ) -> None:
        """Uses self.gene_collection and queries the knowledge
        graph for any matches.
        """
        # do this separately to make only one call to KG
        gene_ids = [i for i, _, _ in self.gene_collection]
        gene_names = self.annotation_neo4j.get_genes_from_gene_ids(
            gene_ids=gene_ids)

        current_app.logger.info(
            f'Failed to find a gene match in the knowledge graph for gene ids {set(gene_ids) - set(gene_names)}.',  # noqa
            extra=EventLog(event_type='annotations').to_dict()
        )

        for (gene_id, entity_name, normalized_name) in self.gene_collection:
            if gene_names.get(gene_id, None):
                entity = create_ner_type_gene(
                    name=gene_names[gene_id],
                    synonym=entity_name
                )
                # differentiate between LMDB
                entity['inclusion'] = True

                if normalized_name in gene_inclusion:
                    gene_inclusion[normalized_name].append(entity)
                else:
                    gene_inclusion[normalized_name] = [entity]

    def set_entity_inclusions(
        self,
        custom_annotations: List[dict],
    ) -> None:
        global_annotations_to_include = [
            inclusion for inclusion, in self.annotation_neo4j.session.query(
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
                    global_annotations_to_include + custom_annotations,
                    entity_type,
                    entity_id_str,
                    inclusion,
                    func
                ) for entity_type, entity_id_str, inclusion, func in self._get_inclusion_pairs()]), maxlen=0)  # noqa
        self._query_genes_from_kg(self.inclusion_type_gene)

    def set_entity_exclusions(
        self,
        excluded_annotations: List[dict]
    ) -> None:
        global_annotations_to_exclude = [
            exclusion for exclusion, in self.annotation_neo4j.session.query(
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
                    global_annotations_to_exclude + excluded_annotations,
                    exclusion,
                    func
                ) for exclusion, func in self._get_exclusion_pairs()]), maxlen=0)

    def identify_entities(
        self,
        tokens: List[PDFTokenPositions],
        check_entities_in_lmdb: Dict[str, bool],
    ) -> None:
        deque(map(partial(
            self._entity_lookup_dispatch,
            check_entities=check_entities_in_lmdb), tokens), maxlen=0)
