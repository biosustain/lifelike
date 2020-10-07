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
    create_chemical_for_ner,
    create_compound_for_ner,
    create_disease_for_ner,
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

        # for the global and local, structured the same as LMDB
        self._local_species_inclusion: Dict[str, List[dict]] = {}
        self.global_chemical_inclusion: Dict[str, List[dict]] = {}
        self.global_compound_inclusion: Dict[str, List[dict]] = {}
        self.global_disease_inclusion: Dict[str, List[dict]] = {}
        self.global_gene_inclusion: Dict[str, List[dict]] = {}
        self.global_phenotype_inclusion: Dict[str, List[dict]] = {}
        self.global_protein_inclusion: Dict[str, List[dict]] = {}
        self.global_species_inclusion: Dict[str, List[dict]] = {}

        self.gene_collection: List[Tuple[str, str, str]] = []

        self._matched_genes: Dict[str, LMDBMatch] = {}
        self._matched_chemicals: Dict[str, LMDBMatch] = {}
        self._matched_compounds: Dict[str, LMDBMatch] = {}
        self._matched_proteins: Dict[str, LMDBMatch] = {}
        self._matched_species: Dict[str, LMDBMatch] = {}
        self._matched_diseases: Dict[str, LMDBMatch] = {}
        self._matched_phenotypes: Dict[str, LMDBMatch] = {}

        self._matched_local_species_inclusion: Dict[str, List[PDFTokenPositions]] = {}

        # TODO: could potentially put into a cache if these words will not be updated
        # often. But future feature will allow users to upload and add
        # to this list, so that means would have to recache.
        # leave as is for now?
        self.exclusion_words = set(
            result.word for result in self.annotation_neo4j.session.query(
                AnnotationStopWords).all())

        self.global_annotations_to_exclude = [
            exclusion for exclusion, in self.annotation_neo4j.session.query(
                GlobalList.annotation).filter(
                    and_(
                        GlobalList.type == ManualAnnotationType.EXCLUSION.value,
                        # TODO: Uncomment once feature to review is there
                        # GlobalList.reviewed.is_(True),
                    )
                )
            ]

        self.global_annotations_to_include = [
            inclusion for inclusion, in self.annotation_neo4j.session.query(
                GlobalList.annotation).filter(
                    and_(
                        GlobalList.type == ManualAnnotationType.INCLUSION.value,
                        # TODO: Uncomment once feature to review is there
                        # GlobalList.reviewed.is_(True),
                    )
                )
            ]

    @property
    def local_species_inclusion(self) -> Dict[str, List[dict]]:
        return self._local_species_inclusion

    @property
    def matched_local_species_inclusion(self) -> Dict[str, List[PDFTokenPositions]]:
        return self._matched_local_species_inclusion

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
        chemical: bool = True,
        compound: bool = True,
        disease: bool = True,
        gene: bool = True,
        phenotype: bool = True,
        protein: bool = True,
        species: bool = True,
    ) -> Dict[str, bool]:
        return {
            EntityType.CHEMICAL.value: chemical,
            EntityType.COMPOUND.value: compound,
            EntityType.DISEASE.value: disease,
            EntityType.GENE.value: gene,
            EntityType.PHENOTYPE.value: phenotype,
            EntityType.PROTEIN.value: protein,
            EntityType.SPECIES.value: species,
        }

    def get_entity_match_results(self) -> EntityResults:
        return EntityResults(
            local_species_inclusion=self.local_species_inclusion,
            matched_local_species_inclusion=self.matched_local_species_inclusion,
            matched_chemicals=self.matched_chemicals,
            matched_compounds=self.matched_compounds,
            matched_diseases=self.matched_diseases,
            matched_genes=self.matched_genes,
            matched_phenotypes=self.matched_phenotypes,
            matched_proteins=self.matched_proteins,
            matched_species=self.matched_species
        )

    def _get_chemical_annotations_to_exclude(self):
        # case insensitive
        return set(
            normalize_str(exclusion.get('text')) for exclusion in self.global_annotations_to_exclude if  # noqa
                exclusion.get('type') == EntityType.CHEMICAL.value and exclusion.get('text'))  # noqa

    def _get_compound_annotations_to_exclude(self):
        # case insensitive
        return set(
            normalize_str(exclusion.get('text')) for exclusion in self.global_annotations_to_exclude if  # noqa
                exclusion.get('type') == EntityType.COMPOUND.value and exclusion.get('text'))  # noqa

    def _get_disease_annotations_to_exclude(self):
        # case insensitive
        return set(
            normalize_str(exclusion.get('text')) for exclusion in self.global_annotations_to_exclude if  # noqa
                exclusion.get('type') == EntityType.DISEASE.value and exclusion.get('text'))  # noqa

    def _get_gene_annotations_to_exclude(self):
        return set(
            exclusion.get('text') for exclusion in self.global_annotations_to_exclude if
                exclusion.get('type') == EntityType.GENE.value and exclusion.get('text'))  # noqa

    def _get_phenotype_annotations_to_exclude(self):
        # case insensitive
        return set(
            normalize_str(exclusion.get('text')) for exclusion in self.global_annotations_to_exclude if  # noqa
                exclusion.get('type') == EntityType.PHENOTYPE.value and exclusion.get('text'))  # noqa

    def _get_protein_annotations_to_exclude(self):
        return set(
            exclusion.get('text') for exclusion in self.global_annotations_to_exclude if
                exclusion.get('type') == EntityType.PROTEIN.value and exclusion.get('text'))  # noqa

    def _get_species_annotations_to_exclude(self):
        # case insensitive
        return set(
            normalize_str(exclusion.get('text')) for exclusion in self.global_annotations_to_exclude if  # noqa
                exclusion.get('type') == EntityType.SPECIES.value and exclusion.get('text'))  # noqa

    def _get_global_inclusion_pairs(self) -> List[Tuple[str, str, Any, Any]]:
        return [
            (EntityType.CHEMICAL.value, EntityIdStr.CHEMICAL.value, self.global_chemical_inclusion, create_chemical_for_ner),  # noqa
            (EntityType.COMPOUND.value, EntityIdStr.COMPOUND.value, self.global_compound_inclusion, create_compound_for_ner),  # noqa
            (EntityType.DISEASE.value, EntityIdStr.DISEASE.value, self.global_disease_inclusion, create_disease_for_ner),  # noqa
            (EntityType.GENE.value, EntityIdStr.GENE.value, self.global_gene_inclusion, create_gene_for_ner),  # noqa
            (EntityType.PHENOTYPE.value, EntityIdStr.PHENOTYPE.value, self.global_phenotype_inclusion, create_phenotype_for_ner),  # noqa
            (EntityType.PROTEIN.value, EntityIdStr.PROTEIN.value, self.global_protein_inclusion, create_protein_for_ner),  # noqa
            (EntityType.SPECIES.value, EntityIdStr.SPECIES.value, self.global_species_inclusion, create_species_for_ner),  # noqa
        ]

    def _set_local_species_inclusion(self, custom_annotations: List[dict]) -> None:
        """Creates a dictionary structured very similar to LMDB.
        Used for local species custom annotation lookups.
        """
        for custom in custom_annotations:
            if custom.get('meta', None):
                if custom['meta'].get('type', None) == EntityType.SPECIES.value:
                    species_id = custom['meta'].get('id', None)
                    species_name = custom['meta'].get('allText', None)
                    normalized_species_name = normalize_str(species_name)

                    if species_id and species_name:
                        if normalized_species_name in self.local_species_inclusion:
                            self.local_species_inclusion[normalized_species_name].append(
                                create_species_for_ner(
                                    id_=species_id,
                                    name=species_name,
                                    synonym=species_name,
                                )
                            )
                        else:
                            self.local_species_inclusion[normalized_species_name] = [
                                create_species_for_ner(
                                    id_=species_id,
                                    name=species_name,
                                    synonym=species_name,
                                )
                            ]

    def _set_global_inclusions(
        self,
        entity_type: str,
        entity_id_str: str,
        global_inclusion: Dict[str, List[dict]],
        create_entity_ner_func,
    ) -> None:
        """Creates a dictionary structured very similar to LMDB.
        Used for global entity custom annotation lookups.
        """
        current_app.logger.info(
            f'Creating global inclusion lookup for {entity_type}',
            extra=EventLog(event_type='annotations').to_dict()
        )
        for inclusion in self.global_annotations_to_include:
            if inclusion.get('meta', None):
                if inclusion['meta'].get('type', None) == entity_type:
                    entity_id = inclusion['meta'].get('id', None)
                    entity_name = inclusion['meta'].get('allText', None)
                    normalized_entity_name = normalize_str(entity_name)

                    if entity_id and entity_name:
                        entity = {}  # to avoid UnboundLocalError
                        if entity_type in {
                            EntityType.CHEMICAL.value,
                            EntityType.COMPOUND.value,
                            EntityType.DISEASE.value,
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
                            else:
                                # protein
                                entity = create_entity_ner_func(
                                    name=entity_name,
                                    synonym=entity_name
                                )

                        # differentiate between LMDB
                        entity['inclusion'] = True

                        if normalized_entity_name in global_inclusion:
                            global_inclusion[normalized_entity_name].append(entity)
                        else:
                            global_inclusion[normalized_entity_name] = [entity]

    def entity_lookup_for_chemicals(
        self,
        global_exclusion: Set[str],
        token: PDFTokenPositions,
        synonym: Optional[str] = None,
    ):
        """Do entity lookups for chemical. First check in LMDB,
        if nothing was found, then check in global inclusions.

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
            lookup_key = normalize_str(token.keyword)

        if len(lookup_key) > 2:
            lowered_word = token.keyword.lower()

            if lowered_word in global_exclusion:
                current_app.logger.info(
                    f'Found a match in chemicals entity lookup but token "{token.keyword}" is a global exclusion.',  # noqa
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
                    # didn't find in LMDB so look in global inclusion
                    chem_val = self.global_chemical_inclusion.get(lookup_key, [])

                if chem_val:
                    if token.keyword in self.matched_chemicals:
                        self.matched_chemicals[token.keyword].tokens.append(token)
                    else:
                        self.matched_chemicals[token.keyword] = LMDBMatch(entities=chem_val, tokens=[token])  # noqa

        return chem_val

    def entity_lookup_for_compounds(
        self,
        global_exclusion: Set[str],
        token: PDFTokenPositions,
        synonym: Optional[str] = None,
    ):
        """Do entity lookups for compound. First check in LMDB,
        if nothing was found, then check in global inclusions.

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
            lookup_key = normalize_str(token.keyword)

        if len(lookup_key) > 2:
            lowered_word = token.keyword.lower()

            if lowered_word in global_exclusion:
                current_app.logger.info(
                    f'Found a match in compounds entity lookup but token "{token.keyword}" is a global exclusion.',  # noqa
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
                    # didn't find in LMDB so look in global inclusion
                    comp_val = self.global_compound_inclusion.get(lookup_key, [])

                if comp_val:
                    if token.keyword in self.matched_compounds:
                        self.matched_compounds[token.keyword].tokens.append(token)
                    else:
                        self.matched_compounds[token.keyword] = LMDBMatch(entities=comp_val, tokens=[token])  # noqa

        return comp_val

    def entity_lookup_for_diseases(
        self,
        global_exclusion: Set[str],
        token: PDFTokenPositions,
        synonym: Optional[str] = None,
    ):
        """Do entity lookups for disease. First check in LMDB,
        if nothing was found, then check in global inclusions.

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
            lookup_key = normalize_str(token.keyword)

        if len(lookup_key) > 2:
            lowered_word = token.keyword.lower()

            if lowered_word in global_exclusion:
                current_app.logger.info(
                    f'Found a match in diseases entity lookup but token "{token.keyword}" is a global exclusion.',  # noqa
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
                    # didn't find in LMDB so look in global inclusion
                    diseases_val = self.global_disease_inclusion.get(lookup_key, [])

                if diseases_val:
                    if token.keyword in self.matched_diseases:
                        self.matched_diseases[token.keyword].tokens.append(token)
                    else:
                        self.matched_diseases[token.keyword] = LMDBMatch(entities=diseases_val, tokens=[token])  # noqa

        return diseases_val

    def entity_lookup_for_genes(
        self,
        global_exclusion: Set[str],
        token: PDFTokenPositions,
        synonym: Optional[str] = None,
    ):
        """Do entity lookups for gene. First check in LMDB,
        if nothing was found, then check in global inclusions.

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
            lookup_key = normalize_str(token.keyword)

        if len(lookup_key) > 2:
            lowered_word = token.keyword.lower()

            if token.keyword in global_exclusion:
                current_app.logger.info(
                    f'Found a match in genes entity lookup but token "{token.keyword}" is a global exclusion.',  # noqa
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
                    # didn't find in LMDB so look in global inclusion
                    gene_val = self.global_gene_inclusion.get(lookup_key, [])

                if gene_val:
                    if token.keyword in self.matched_genes:
                        self.matched_genes[token.keyword].tokens.append(token)
                    else:
                        self.matched_genes[token.keyword] = LMDBMatch(entities=gene_val, tokens=[token])  # noqa

        return gene_val

    def entity_lookup_for_phenotypes(
        self,
        global_exclusion: Set[str],
        token: PDFTokenPositions,
        synonym: Optional[str] = None,
    ):
        """Do entity lookups for phenotype. First check in LMDB,
        if nothing was found, then check in global inclusions.

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
            lookup_key = normalize_str(token.keyword)

        if len(lookup_key) > 2:
            lowered_word = token.keyword.lower()

            if lowered_word in global_exclusion:
                current_app.logger.info(
                    f'Found a match in phenotypes entity lookup but token "{token.keyword}" is a global exclusion.',  # noqa
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
                    # didn't find in LMDB so look in global inclusion
                    phenotype_val = self.global_phenotype_inclusion.get(lookup_key, [])

                if phenotype_val:
                    if token.keyword in self.matched_phenotypes:
                        self.matched_phenotypes[token.keyword].tokens.append(token)
                    else:
                        self.matched_phenotypes[token.keyword] = LMDBMatch(entities=phenotype_val, tokens=[token])  # noqa

        return phenotype_val

    def entity_lookup_for_proteins(
        self,
        global_exclusion: Set[str],
        token: PDFTokenPositions,
        synonym: Optional[str] = None,
    ):
        """Do entity lookups for protein. First check in LMDB,
        if nothing was found, then check in global inclusions.

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
            lookup_key = normalize_str(token.keyword)

        if len(lookup_key) > 2:
            lowered_word = token.keyword.lower()

            if token.keyword in global_exclusion:
                current_app.logger.info(
                    f'Found a match in proteins entity lookup but token "{token.keyword}" is a global exclusion.',  # noqa
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
                    # didn't find in LMDB so look in global inclusion
                    protein_val = self.global_protein_inclusion.get(lookup_key, [])

                if protein_val:
                    if token.keyword in self.matched_proteins:
                        self.matched_proteins[token.keyword].tokens.append(token)
                    else:
                        self.matched_proteins[token.keyword] = LMDBMatch(entities=protein_val, tokens=[token])  # noqa

        return protein_val

    def entity_lookup_for_species(
        self,
        global_exclusion: Set[str],
        token: PDFTokenPositions,
        synonym: Optional[str] = None,
    ):
        """Do entity lookups for species. First check in LMDB,
        if nothing was found, then check in global inclusions.

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
            lookup_key = normalize_str(token.keyword)

        if len(lookup_key) > 2:
            lowered_word = token.keyword.lower()

            if lowered_word in global_exclusion:
                current_app.logger.info(
                    f'Found a match in species entity lookup but token "{token.keyword}" is a global exclusion.',  # noqa
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
                    # didn't find in LMDB so look in global inclusion
                    species_val = self.global_species_inclusion.get(lookup_key, [])

                if species_val or lookup_key in self.local_species_inclusion:  # noqa
                    if lookup_key in self.local_species_inclusion:
                        if token.keyword in self.matched_local_species_inclusion:
                            self.matched_local_species_inclusion[token.keyword].append(token)
                        else:
                            self.matched_local_species_inclusion[token.keyword] = [token]
                    else:
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
        global_exclusions: Dict[str, set]
    ) -> None:
        if check_entities.get(EntityType.CHEMICAL.value, False):
            self._find_chemical_match(token, global_exclusions[EntityType.CHEMICAL.value])

        if check_entities.get(EntityType.COMPOUND.value, False):
            self._find_compound_match(token, global_exclusions[EntityType.COMPOUND.value])

        if check_entities.get(EntityType.DISEASE.value, False):
            self._find_disease_match(token, global_exclusions[EntityType.DISEASE.value])

        if check_entities.get(EntityType.GENE.value, False):
            self._find_gene_match(token, global_exclusions[EntityType.GENE.value])

        if check_entities.get(EntityType.PHENOTYPE.value, False):
            self._find_phenotype_match(token, global_exclusions[EntityType.PHENOTYPE.value])

        if check_entities.get(EntityType.PROTEIN.value, False):
            self._find_protein_match(token, global_exclusions[EntityType.PROTEIN.value])

        if check_entities.get(EntityType.SPECIES.value, False):
            self._find_species_match(token, global_exclusions[EntityType.SPECIES.value])

    def _find_chemical_match(self, token: PDFTokenPositions, global_exclusion: Set[str]) -> None:
        word = token.keyword
        if word:
            if word in COMMON_TYPOS:
                for correct_spelling in COMMON_TYPOS[word]:
                    exist = self.entity_lookup_for_chemicals(
                        global_exclusion=global_exclusion,
                        token=token,
                        synonym=correct_spelling
                    )

                    # if any that means there was a match
                    if exist is not None:
                        break
            else:
                self.entity_lookup_for_chemicals(
                    global_exclusion=global_exclusion,
                    token=token
                )

    def _find_compound_match(self, token: PDFTokenPositions, global_exclusion: Set[str]) -> None:
        word = token.keyword
        if word:
            if word in COMMON_TYPOS:
                for correct_spelling in COMMON_TYPOS[word]:
                    exist = self.entity_lookup_for_compounds(
                        global_exclusion=global_exclusion,
                        token=token,
                        synonym=correct_spelling
                    )

                    # if any that means there was a match
                    if exist is not None:
                        break
            else:
                self.entity_lookup_for_compounds(
                    global_exclusion=global_exclusion,
                    token=token
                )

    def _find_disease_match(self, token: PDFTokenPositions, global_exclusion: Set[str]) -> None:
        word = token.keyword
        if word:
            if word in COMMON_TYPOS:
                for correct_spelling in COMMON_TYPOS[word]:
                    exist = self.entity_lookup_for_diseases(
                        global_exclusion=global_exclusion,
                        token=token,
                        synonym=correct_spelling
                    )

                    # if any that means there was a match
                    if exist is not None:
                        break
            else:
                self.entity_lookup_for_diseases(
                    global_exclusion=global_exclusion,
                    token=token
                )

    def _find_gene_match(self, token: PDFTokenPositions, global_exclusion: Set[str]) -> None:
        word = token.keyword
        if word:
            if word in COMMON_TYPOS:
                for correct_spelling in COMMON_TYPOS[word]:
                    exist = self.entity_lookup_for_genes(
                        global_exclusion=global_exclusion,
                        token=token,
                        synonym=correct_spelling
                    )

                    # if any that means there was a match
                    if exist is not None:
                        break
            else:
                self.entity_lookup_for_genes(
                    global_exclusion=global_exclusion,
                    token=token
                )

    def _find_phenotype_match(self, token: PDFTokenPositions, global_exclusion: Set[str]) -> None:
        word = token.keyword
        if word:
            if word in COMMON_TYPOS:
                for correct_spelling in COMMON_TYPOS[word]:
                    exist = self.entity_lookup_for_phenotypes(
                        global_exclusion=global_exclusion,
                        token=token,
                        synonym=correct_spelling
                    )

                    # if any that means there was a match
                    if exist is not None:
                        break
            else:
                self.entity_lookup_for_phenotypes(
                    global_exclusion=global_exclusion,
                    token=token
                )

    def _find_protein_match(self, token: PDFTokenPositions, global_exclusion: Set[str]) -> None:
        word = token.keyword
        if word:
            if word in COMMON_TYPOS:
                for correct_spelling in COMMON_TYPOS[word]:
                    exist = self.entity_lookup_for_proteins(
                        global_exclusion=global_exclusion,
                        token=token,
                        synonym=correct_spelling
                    )

                    # if any that means there was a match
                    if exist is not None:
                        break
            else:
                self.entity_lookup_for_proteins(
                    global_exclusion=global_exclusion,
                    token=token
                )

    def _find_species_match(self, token: PDFTokenPositions, global_exclusion: Set[str]) -> None:
        word = token.keyword
        if word:
            if word in COMMON_TYPOS:
                for correct_spelling in COMMON_TYPOS[word]:
                    exist = self.entity_lookup_for_species(
                        global_exclusion=global_exclusion,
                        token=token,
                        synonym=correct_spelling
                    )

                    # if any that means there was a match
                    if exist is not None:
                        break
            else:
                self.entity_lookup_for_species(
                    global_exclusion=global_exclusion,
                    token=token
                )

    def set_entity_inclusions(
        self,
        custom_annotations: List[dict],
    ) -> None:
        self._set_local_species_inclusion(custom_annotations)
        deque(starmap(self._set_global_inclusions, self._get_global_inclusion_pairs()), maxlen=0)  # noqa

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

                if normalized_name in self.global_gene_inclusion:
                    self.global_gene_inclusion[normalized_name].append(entity)
                else:
                    self.global_gene_inclusion[normalized_name] = [entity]

    def identify_entities(
        self,
        tokens: List[PDFTokenPositions],
        check_entities_in_lmdb: Dict[str, bool],
    ) -> None:
        global_exclusions = {
            EntityType.CHEMICAL.value: self._get_chemical_annotations_to_exclude(),
            EntityType.COMPOUND.value: self._get_compound_annotations_to_exclude(),
            EntityType.DISEASE.value: self._get_disease_annotations_to_exclude(),
            EntityType.GENE.value: self._get_gene_annotations_to_exclude(),
            EntityType.PHENOTYPE.value: self._get_phenotype_annotations_to_exclude(),
            EntityType.PROTEIN.value: self._get_protein_annotations_to_exclude(),
            EntityType.SPECIES.value: self._get_species_annotations_to_exclude()
        }
        deque(map(partial(
            self._entity_lookup_dispatch,
            check_entities=check_entities_in_lmdb,
            global_exclusions=global_exclusions), tokens), maxlen=0)
