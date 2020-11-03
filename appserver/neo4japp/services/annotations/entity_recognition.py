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
    create_anatomy_for_ner,
    create_chemical_for_ner,
    create_compound_for_ner,
    create_disease_for_ner,
    create_food_for_ner,
    create_gene_for_ner,
    create_phenotype_for_ner,
    create_protein_for_ner,
    create_species_for_ner,
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
        self._anatomy_inclusion: Dict[str, List[dict]] = {}
        self._chemical_inclusion: Dict[str, List[dict]] = {}
        self._compound_inclusion: Dict[str, List[dict]] = {}
        self._disease_inclusion: Dict[str, List[dict]] = {}
        self._food_inclusion: Dict[str, List[dict]] = {}
        self._gene_inclusion: Dict[str, List[dict]] = {}
        self._phenotype_inclusion: Dict[str, List[dict]] = {}
        self._protein_inclusion: Dict[str, List[dict]] = {}
        self._species_inclusion: Dict[str, List[dict]] = {}

        self._anatomy_exclusion: Set[str] = set()
        self._chemical_exclusion: Set[str] = set()
        self._compound_exclusion: Set[str] = set()
        self._disease_exclusion: Set[str] = set()
        self._food_exclusion: Set[str] = set()
        self._gene_exclusion: Set[str] = set()
        self._phenotype_exclusion: Set[str] = set()
        self._protein_exclusion: Set[str] = set()
        self._species_exclusion: Set[str] = set()

        self._gene_collection: List[Tuple[str, str, str]] = []

        self._matched_anatomy: Dict[str, LMDBMatch] = {}
        self._matched_chemicals: Dict[str, LMDBMatch] = {}
        self._matched_compounds: Dict[str, LMDBMatch] = {}
        self._matched_genes: Dict[str, LMDBMatch] = {}
        self._matched_diseases: Dict[str, LMDBMatch] = {}
        self._matched_foods: Dict[str, LMDBMatch] = {}
        self._matched_proteins: Dict[str, LMDBMatch] = {}
        self._matched_phenotypes: Dict[str, LMDBMatch] = {}
        self._matched_species: Dict[str, LMDBMatch] = {}

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
    def anatomy_inclusion(self) -> Dict[str, List[dict]]:
        return self._anatomy_inclusion

    @property
    def chemical_inclusion(self) -> Dict[str, List[dict]]:
        return self._chemical_inclusion

    @property
    def compound_inclusion(self) -> Dict[str, List[dict]]:
        return self._compound_inclusion

    @property
    def disease_inclusion(self) -> Dict[str, List[dict]]:
        return self._disease_inclusion

    @property
    def food_inclusion(self) -> Dict[str, List[dict]]:
        return self._food_inclusion

    @property
    def gene_inclusion(self) -> Dict[str, List[dict]]:
        return self._gene_inclusion

    @property
    def phenotype_inclusion(self) -> Dict[str, List[dict]]:
        return self._phenotype_inclusion

    @property
    def protein_inclusion(self) -> Dict[str, List[dict]]:
        return self._protein_inclusion

    @property
    def species_inclusion(self) -> Dict[str, List[dict]]:
        return self._species_inclusion

    @property
    def anatomy_exclusion(self) -> Set[str]:
        return self._anatomy_exclusion

    @property
    def chemical_exclusion(self) -> Set[str]:
        return self._chemical_exclusion

    @property
    def compound_exclusion(self) -> Set[str]:
        return self._compound_exclusion

    @property
    def disease_exclusion(self) -> Set[str]:
        return self._disease_exclusion

    @property
    def food_exclusion(self) -> Set[str]:
        return self._food_exclusion

    @property
    def gene_exclusion(self) -> Set[str]:
        return self._gene_exclusion

    @property
    def phenotype_exclusion(self) -> Set[str]:
        return self._phenotype_exclusion

    @property
    def protein_exclusion(self) -> Set[str]:
        return self._protein_exclusion

    @property
    def species_exclusion(self) -> Set[str]:
        return self._species_exclusion

    @property
    def matched_anatomy(self) -> Dict[str, LMDBMatch]:
        return self._matched_anatomy

    @property
    def matched_chemicals(self) -> Dict[str, LMDBMatch]:
        return self._matched_chemicals

    @property
    def matched_compounds(self) -> Dict[str, LMDBMatch]:
        return self._matched_compounds

    @property
    def matched_diseases(self) -> Dict[str, LMDBMatch]:
        return self._matched_diseases

    @property
    def matched_foods(self) -> Dict[str, LMDBMatch]:
        return self._matched_foods

    @property
    def matched_genes(self) -> Dict[str, LMDBMatch]:
        return self._matched_genes

    @property
    def matched_phenotypes(self) -> Dict[str, LMDBMatch]:
        return self._matched_phenotypes

    @property
    def matched_proteins(self) -> Dict[str, LMDBMatch]:
        return self._matched_proteins

    @property
    def matched_species(self) -> Dict[str, LMDBMatch]:
        return self._matched_species

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
        }

    def get_entity_match_results(self) -> EntityResults:
        return EntityResults(
            matched_anatomy=self.matched_anatomy,
            matched_chemicals=self.matched_chemicals,
            matched_compounds=self.matched_compounds,
            matched_diseases=self.matched_diseases,
            matched_foods=self.matched_foods,
            matched_genes=self.matched_genes,
            matched_phenotypes=self.matched_phenotypes,
            matched_proteins=self.matched_proteins,
            matched_species=self.matched_species
        )

    def _get_anatomy_annotations_to_exclude(
        self,
        exclusion_collection: Set[str],
        exclusion_list: List[dict]
    ):
        # case insensitive
        for exclusion in exclusion_list:
            if exclusion.get('text') and exclusion.get('type') == EntityType.ANATOMY.value:
                exclusion_collection.add(normalize_str(exclusion.get('text')))

    def _get_chemical_annotations_to_exclude(
        self,
        exclusion_collection: Set[str],
        exclusion_list: List[dict]
    ):
        # case insensitive
        for exclusion in exclusion_list:
            if exclusion.get('text') and exclusion.get('type') == EntityType.CHEMICAL.value:
                exclusion_collection.add(normalize_str(exclusion.get('text')))

    def _get_compound_annotations_to_exclude(
        self,
        exclusion_collection: Set[str],
        exclusion_list: List[dict]
    ):
        # case insensitive
        for exclusion in exclusion_list:
            if exclusion.get('text') and exclusion.get('type') == EntityType.COMPOUND.value:
                exclusion_collection.add(normalize_str(exclusion.get('text')))

    def _get_disease_annotations_to_exclude(
        self,
        exclusion_collection: Set[str],
        exclusion_list: List[dict]
    ):
        # case insensitive
        for exclusion in exclusion_list:
            if exclusion.get('text') and exclusion.get('type') == EntityType.DISEASE.value:
                exclusion_collection.add(normalize_str(exclusion.get('text')))

    def _get_food_annotations_to_exclude(
        self,
        exclusion_collection: Set[str],
        exclusion_list: List[dict]
    ):
        # case insensitive
        for exclusion in exclusion_list:
            if exclusion.get('text') and exclusion.get('type') == EntityType.FOOD.value:
                exclusion_collection.add(normalize_str(exclusion.get('text')))

    def _get_gene_annotations_to_exclude(
        self,
        exclusion_collection: Set[str],
        exclusion_list: List[dict]
    ):
        for exclusion in exclusion_list:
            if exclusion.get('text') and exclusion.get('type') == EntityType.GENE.value:
                exclusion_collection.add(exclusion.get('text'))  # type: ignore

    def _get_phenotype_annotations_to_exclude(
        self,
        exclusion_collection: Set[str],
        exclusion_list: List[dict]
    ):
        # case insensitive
        for exclusion in exclusion_list:
            if exclusion.get('text') and exclusion.get('type') == EntityType.PHENOTYPE.value:
                exclusion_collection.add(normalize_str(exclusion.get('text')))

    def _get_protein_annotations_to_exclude(
        self,
        exclusion_collection: Set[str],
        exclusion_list: List[dict]
    ):
        for exclusion in exclusion_list:
            if exclusion.get('text') and exclusion.get('type') == EntityType.PROTEIN.value:
                exclusion_collection.add(exclusion.get('text'))  # type: ignore

    def _get_species_annotations_to_exclude(
        self,
        exclusion_collection: Set[str],
        exclusion_list: List[dict]
    ):
        # case insensitive
        for exclusion in exclusion_list:
            if exclusion.get('text') and exclusion.get('type') == EntityType.SPECIES.value:
                exclusion_collection.add(normalize_str(exclusion.get('text')))

    def _get_inclusion_pairs(self) -> List[Tuple[str, str, Any, Any]]:
        return [
            (EntityType.ANATOMY.value, EntityIdStr.ANATOMY.value, self.anatomy_inclusion, create_anatomy_for_ner),  # noqa
            (EntityType.CHEMICAL.value, EntityIdStr.CHEMICAL.value, self.chemical_inclusion, create_chemical_for_ner),  # noqa
            (EntityType.COMPOUND.value, EntityIdStr.COMPOUND.value, self.compound_inclusion, create_compound_for_ner),  # noqa
            (EntityType.DISEASE.value, EntityIdStr.DISEASE.value, self.disease_inclusion, create_disease_for_ner),  # noqa
            (EntityType.FOOD.value, EntityIdStr.FOOD.value, self.food_inclusion, create_food_for_ner),  # noqa
            (EntityType.GENE.value, EntityIdStr.GENE.value, self.gene_inclusion, create_gene_for_ner),  # noqa
            (EntityType.PHENOTYPE.value, EntityIdStr.PHENOTYPE.value, self.phenotype_inclusion, create_phenotype_for_ner),  # noqa
            (EntityType.PROTEIN.value, EntityIdStr.PROTEIN.value, self.protein_inclusion, create_protein_for_ner),  # noqa
            (EntityType.SPECIES.value, EntityIdStr.SPECIES.value, self.species_inclusion, create_species_for_ner)  # noqa
        ]

    def _get_exclusion_pairs(self) -> List[Tuple[Set[str], Any]]:
        return [
            (self.anatomy_exclusion, self._get_anatomy_annotations_to_exclude),
            (self.chemical_exclusion, self._get_chemical_annotations_to_exclude),
            (self.compound_exclusion, self._get_compound_annotations_to_exclude),
            (self.disease_exclusion, self._get_disease_annotations_to_exclude),
            (self.food_exclusion, self._get_food_annotations_to_exclude),
            (self.gene_exclusion, self._get_gene_annotations_to_exclude),
            (self.phenotype_exclusion, self._get_phenotype_annotations_to_exclude),
            (self.protein_exclusion, self._get_protein_annotations_to_exclude),
            (self.species_exclusion, self._get_species_annotations_to_exclude)
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

                if entity_id and entity_name and entity_type == entity_type_to_include:
                    entity = {}  # to avoid UnboundLocalError
                    if entity_type_to_include in {
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

    def entity_lookup_for_anatomy(
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

            if lowered_word in self.anatomy_exclusion:
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
                    anatomy_val = self.anatomy_inclusion.get(lookup_key, [])

                if anatomy_val:
                    if token.keyword in self.matched_anatomy:
                        self.matched_anatomy[token.keyword].tokens.append(token)
                    else:
                        self.matched_anatomy[token.keyword] = LMDBMatch(
                            entities=anatomy_val,  # type: ignore
                            tokens=[token]
                        )
        return anatomy_val

    def entity_lookup_for_chemicals(
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

            if lowered_word in self.chemical_exclusion:
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
                    chem_val = self.chemical_inclusion.get(lookup_key, [])

                if chem_val:
                    if token.keyword in self.matched_chemicals:
                        self.matched_chemicals[token.keyword].tokens.append(token)
                    else:
                        self.matched_chemicals[token.keyword] = LMDBMatch(
                            entities=chem_val,  # type: ignore
                            tokens=[token]
                        )
        return chem_val

    def entity_lookup_for_compounds(
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

            if lowered_word in self.compound_exclusion:
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
                    comp_val = self.compound_inclusion.get(lookup_key, [])

                if comp_val:
                    if token.keyword in self.matched_compounds:
                        self.matched_compounds[token.keyword].tokens.append(token)
                    else:
                        self.matched_compounds[token.keyword] = LMDBMatch(
                            entities=comp_val,  # type: ignore
                            tokens=[token]
                        )
        return comp_val

    def entity_lookup_for_diseases(
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

            if lowered_word in self.disease_exclusion:
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
                    diseases_val = self.disease_inclusion.get(lookup_key, [])

                if diseases_val:
                    if token.keyword in self.matched_diseases:
                        self.matched_diseases[token.keyword].tokens.append(token)
                    else:
                        self.matched_diseases[token.keyword] = LMDBMatch(
                            entities=diseases_val,  # type: ignore
                            tokens=[token]
                        )
        return diseases_val

    def entity_lookup_for_foods(
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

            if lowered_word in self.food_exclusion:
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
                    food_val = self.food_inclusion.get(lookup_key, [])

                if food_val:
                    if token.keyword in self.matched_foods:
                        self.matched_foods[token.keyword].tokens.append(token)
                    else:
                        self.matched_foods[token.keyword] = LMDBMatch(
                            entities=food_val,  # type: ignore
                            tokens=[token]
                        )
        return food_val

    def entity_lookup_for_genes(
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

            if token.keyword in self.gene_exclusion:
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
                    gene_val = self.gene_inclusion.get(lookup_key, [])

                if gene_val:
                    if token.keyword in self.matched_genes:
                        self.matched_genes[token.keyword].tokens.append(token)
                    else:
                        self.matched_genes[token.keyword] = LMDBMatch(
                            entities=gene_val,  # type: ignore
                            tokens=[token]
                        )
        return gene_val

    def entity_lookup_for_phenotypes(
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

            if lowered_word in self.phenotype_exclusion:
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
                    phenotype_val = self.phenotype_inclusion.get(lookup_key, [])

                if phenotype_val:
                    if token.keyword in self.matched_phenotypes:
                        self.matched_phenotypes[token.keyword].tokens.append(token)
                    else:
                        self.matched_phenotypes[token.keyword] = LMDBMatch(
                            entities=phenotype_val,  # type: ignore
                            tokens=[token]
                        )
        return phenotype_val

    def entity_lookup_for_proteins(
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

            if token.keyword in self.protein_exclusion:
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
                    protein_val = self.protein_inclusion.get(lookup_key, [])

                if protein_val:
                    if token.keyword in self.matched_proteins:
                        self.matched_proteins[token.keyword].tokens.append(token)
                    else:
                        self.matched_proteins[token.keyword] = LMDBMatch(
                            entities=protein_val,  # type: ignore
                            tokens=[token]
                        )
        return protein_val

    def entity_lookup_for_species(
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

            if lowered_word in self.species_exclusion:
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
                    species_val = self.species_inclusion.get(lookup_key, [])

                if species_val:
                    if token.keyword in self.matched_species:
                        self.matched_species[token.keyword].tokens.append(token)
                    else:
                        self.matched_species[token.keyword] = LMDBMatch(
                            entities=species_val,  # type: ignore
                            tokens=[token]
                        )
        return species_val

    def _entity_lookup_dispatch(
        self,
        token: PDFTokenPositions,
        check_entities: Dict[str, bool],
    ) -> None:
        if check_entities.get(EntityType.ANATOMY.value, False):
            self._find_anatomy_match(token)

        if check_entities.get(EntityType.CHEMICAL.value, False):
            self._find_chemical_match(token)

        if check_entities.get(EntityType.COMPOUND.value, False):
            self._find_compound_match(token)

        if check_entities.get(EntityType.DISEASE.value, False):
            self._find_disease_match(token)

        if check_entities.get(EntityType.FOOD.value, False):
            self._find_food_match(token)

        if check_entities.get(EntityType.GENE.value, False):
            self._find_gene_match(token)

        if check_entities.get(EntityType.PHENOTYPE.value, False):
            self._find_phenotype_match(token)

        if check_entities.get(EntityType.PROTEIN.value, False):
            self._find_protein_match(token)

        if check_entities.get(EntityType.SPECIES.value, False):
            self._find_species_match(token)

    def _find_anatomy_match(self, token: PDFTokenPositions) -> None:
        word = token.keyword
        if word:
            if word in COMMON_TYPOS:
                for correct_spelling in COMMON_TYPOS[word]:
                    exist = self.entity_lookup_for_anatomy(
                        token=token,
                        synonym=correct_spelling
                    )

                    # if any that means there was a match
                    if exist is not None:
                        break
            else:
                self.entity_lookup_for_anatomy(
                    token=token
                )

    def _find_chemical_match(self, token: PDFTokenPositions) -> None:
        word = token.keyword
        if word:
            if word in COMMON_TYPOS:
                for correct_spelling in COMMON_TYPOS[word]:
                    exist = self.entity_lookup_for_chemicals(
                        token=token,
                        synonym=correct_spelling
                    )

                    # if any that means there was a match
                    if exist is not None:
                        break
            else:
                self.entity_lookup_for_chemicals(
                    token=token
                )

    def _find_compound_match(self, token: PDFTokenPositions) -> None:
        word = token.keyword
        if word:
            if word in COMMON_TYPOS:
                for correct_spelling in COMMON_TYPOS[word]:
                    exist = self.entity_lookup_for_compounds(
                        token=token,
                        synonym=correct_spelling
                    )

                    # if any that means there was a match
                    if exist is not None:
                        break
            else:
                self.entity_lookup_for_compounds(
                    token=token
                )

    def _find_disease_match(self, token: PDFTokenPositions) -> None:
        word = token.keyword
        if word:
            if word in COMMON_TYPOS:
                for correct_spelling in COMMON_TYPOS[word]:
                    exist = self.entity_lookup_for_diseases(
                        token=token,
                        synonym=correct_spelling
                    )

                    # if any that means there was a match
                    if exist is not None:
                        break
            else:
                self.entity_lookup_for_diseases(
                    token=token
                )

    def _find_food_match(self, token: PDFTokenPositions) -> None:
        word = token.keyword
        if word:
            if word in COMMON_TYPOS:
                for correct_spelling in COMMON_TYPOS[word]:
                    exist = self.entity_lookup_for_foods(
                        token=token,
                        synonym=correct_spelling
                    )

                    # if any that means there was a match
                    if exist is not None:
                        break
            else:
                self.entity_lookup_for_foods(
                    token=token
                )

    def _find_gene_match(self, token: PDFTokenPositions) -> None:
        word = token.keyword
        if word:
            if word in COMMON_TYPOS:
                for correct_spelling in COMMON_TYPOS[word]:
                    exist = self.entity_lookup_for_genes(
                        token=token,
                        synonym=correct_spelling
                    )

                    # if any that means there was a match
                    if exist is not None:
                        break
            else:
                self.entity_lookup_for_genes(
                    token=token
                )

    def _find_phenotype_match(self, token: PDFTokenPositions) -> None:
        word = token.keyword
        if word:
            if word in COMMON_TYPOS:
                for correct_spelling in COMMON_TYPOS[word]:
                    exist = self.entity_lookup_for_phenotypes(
                        token=token,
                        synonym=correct_spelling
                    )

                    # if any that means there was a match
                    if exist is not None:
                        break
            else:
                self.entity_lookup_for_phenotypes(
                    token=token
                )

    def _find_protein_match(self, token: PDFTokenPositions) -> None:
        word = token.keyword
        if word:
            if word in COMMON_TYPOS:
                for correct_spelling in COMMON_TYPOS[word]:
                    exist = self.entity_lookup_for_proteins(
                        token=token,
                        synonym=correct_spelling
                    )

                    # if any that means there was a match
                    if exist is not None:
                        break
            else:
                self.entity_lookup_for_proteins(
                    token=token
                )

    def _find_species_match(self, token: PDFTokenPositions) -> None:
        word = token.keyword
        if word:
            if word in COMMON_TYPOS:
                for correct_spelling in COMMON_TYPOS[word]:
                    exist = self.entity_lookup_for_species(
                        token=token,
                        synonym=correct_spelling
                    )

                    # if any that means there was a match
                    if exist is not None:
                        break
            else:
                self.entity_lookup_for_species(
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
                entity = create_gene_for_ner(
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
        self._query_genes_from_kg(self.gene_inclusion)

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
