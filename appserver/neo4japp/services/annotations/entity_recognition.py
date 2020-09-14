from collections import deque
from functools import partial
from itertools import starmap
from typing import Any, Dict, List, Optional, Tuple

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
                        GlobalList.type == ManualAnnotationType.Exclusion.value,
                        # TODO: Uncomment once feature to review is there
                        # GlobalList.reviewed.is_(True),
                    )
                )
            ]

        self.global_annotations_to_include = [
            inclusion for inclusion, in self.annotation_neo4j.session.query(
                GlobalList.annotation).filter(
                    and_(
                        GlobalList.type == ManualAnnotationType.Inclusion.value,
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
            EntityType.Chemical.value: chemical,
            EntityType.Compound.value: compound,
            EntityType.Disease.value: disease,
            EntityType.Gene.value: gene,
            EntityType.Phenotype.value: phenotype,
            EntityType.Protein.value: protein,
            EntityType.Species.value: species,
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
        return set(
            exclusion.get('text') for exclusion in self.global_annotations_to_exclude if
                exclusion.get('type') == EntityType.Chemical.value and exclusion.get('text'))  # noqa

    def _get_compound_annotations_to_exclude(self):
        return set(
            exclusion.get('text') for exclusion in self.global_annotations_to_exclude if
                exclusion.get('type') == EntityType.Compound.value and exclusion.get('text'))  # noqa

    def _get_disease_annotations_to_exclude(self):
        return set(
            exclusion.get('text') for exclusion in self.global_annotations_to_exclude if
                exclusion.get('type') == EntityType.Disease.value and exclusion.get('text'))  # noqa

    def _get_gene_annotations_to_exclude(self):
        return set(
            exclusion.get('text') for exclusion in self.global_annotations_to_exclude if
                exclusion.get('type') == EntityType.Gene.value and exclusion.get('text'))  # noqa

    def _get_phenotype_annotations_to_exclude(self):
        return set(
            exclusion.get('text') for exclusion in self.global_annotations_to_exclude if
                exclusion.get('type') == EntityType.Phenotype.value and exclusion.get('text'))  # noqa

    def _get_protein_annotations_to_exclude(self):
        return set(
            exclusion.get('text') for exclusion in self.global_annotations_to_exclude if
                exclusion.get('type') == EntityType.Protein.value and exclusion.get('text'))  # noqa

    def _get_species_annotations_to_exclude(self):
        return set(
            exclusion.get('text') for exclusion in self.global_annotations_to_exclude if
                exclusion.get('type') == EntityType.Species.value and exclusion.get('text'))  # noqa

    def _get_global_inclusion_pairs(self) -> List[Tuple[str, str, Any, Any]]:
        return [
            (EntityType.Chemical.value, EntityIdStr.Chemical.value, self.global_chemical_inclusion, create_chemical_for_ner),  # noqa
            (EntityType.Compound.value, EntityIdStr.Compound.value, self.global_compound_inclusion, create_compound_for_ner),  # noqa
            (EntityType.Disease.value, EntityIdStr.Disease.value, self.global_disease_inclusion, create_disease_for_ner),  # noqa
            (EntityType.Gene.value, EntityIdStr.Gene.value, self.global_gene_inclusion, create_gene_for_ner),  # noqa
            (EntityType.Phenotype.value, EntityIdStr.Phenotype.value, self.global_phenotype_inclusion, create_phenotype_for_ner),  # noqa
            (EntityType.Protein.value, EntityIdStr.Protein.value, self.global_protein_inclusion, create_protein_for_ner),  # noqa
            (EntityType.Species.value, EntityIdStr.Species.value, self.global_species_inclusion, create_species_for_ner),  # noqa
        ]

    def _set_local_species_inclusion(self, custom_annotations: List[dict]) -> None:
        """Creates a dictionary structured very similar to LMDB.
        Used for local species custom annotation lookups.
        """
        for custom in custom_annotations:
            if custom.get('meta', None):
                if custom['meta'].get('type', None) == EntityType.Species.value:
                    species_id = custom['meta'].get('id', None)
                    species_name = custom['meta'].get('allText', None)
                    normalized_species_name = normalize_str(species_name)

                    if species_id and species_name:
                        if normalized_species_name in self.local_species_inclusion:
                            unique = all(
                                [
                                    entity['tax_id'] != species_id for
                                    entity in self.local_species_inclusion[normalized_species_name]
                                ]
                            )
                            # need to check unique because a custom annotation
                            # can have multiple of the same entity
                            if unique:
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
                        unique = all(
                            [
                                entity[entity_id_str] != entity_id for
                                entity in global_inclusion.get(normalized_entity_name, [])  # noqa
                            ]
                        )
                        # need to check unique because a custom annotation
                        # can have multiple of the same entity
                        if unique:
                            entity = {}  # to avoid UnboundLocalError
                            if entity_type in {
                                EntityType.Chemical.value,
                                EntityType.Compound.value,
                                EntityType.Disease.value,
                                EntityType.Phenotype.value,
                                EntityType.Species.value
                            }:
                                entity = create_entity_ner_func(
                                    id_=entity_id,
                                    name=entity_name,
                                    synonym=entity_name
                                )
                            else:
                                if entity_type == EntityType.Gene.value:
                                    # the word manually annotated by user
                                    # will not be in the KG
                                    # otherwise it would've been annotated
                                    # so we use the gene_id to query the KG to get
                                    # the correct gene name and use that gene name
                                    # as the synonym too for gene/organism matching
                                    gene_name = self.annotation_neo4j.get_genes_from_gene_ids(gene_ids=[entity_id])  # noqa
                                    if gene_name:
                                        entity = create_entity_ner_func(
                                            name=gene_name.pop(),
                                            synonym=entity_name
                                        )

                                        # gene doesn't have id in LMDB
                                        # but we need to add it here for global inclusions
                                        # because the user could add a gene id
                                        # which we use to check for unique above
                                        entity[entity_id_str] = entity_id
                                    else:
                                        current_app.logger.info(
                                            f'Did not find a gene match with id {entity_id}.',
                                            extra=EventLog(event_type='annotations').to_dict()
                                        )
                                        current_app.logger.debug(
                                            f'<_set_global_inclusions()>: Failed to find a gene match in ' +  # noqa
                                            f'the knowledge graph with id {entity_id}.',
                                            extra=EventLog(event_type='annotations').to_dict()
                                        )
                                        # continue here, otherwise will reach
                                        # entity['inclusion'] = True below and
                                        # we don't want that, get KeyError entity['name'] later
                                        continue
                                else:
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
            if nlp_predicted_type == EntityType.Chemical.value:
                chem_val = self.lmdb_session.get_lmdb_values(
                    txn=self.lmdb_session.chemicals_txn,
                    key=lookup_key,
                    token_type=EntityType.Chemical.value
                )
            elif nlp_predicted_type is None:
                chem_val = self.lmdb_session.get_lmdb_values(
                    txn=self.lmdb_session.chemicals_txn,
                    key=lookup_key,
                    token_type=EntityType.Chemical.value
                )

            if not chem_val:
                # didn't find in LMDB so look in global inclusion
                chem_val = self.global_chemical_inclusion.get(lookup_key, [])

            lowered_word = token.keyword.lower()

            if chem_val:
                if token.keyword in self._get_chemical_annotations_to_exclude():
                    current_app.logger.info(
                        f'Found a match in entity lookup but token "{token.keyword}" is a global exclusion.',  # noqa
                        extra=EventLog(event_type='annotations').to_dict()
                    )
                    current_app.logger.debug(
                        f'<entity_lookup_for_chemicals()> Found a match in entity lookup for "{token.keyword}". '  # noqa
                        f'But token "{token.keyword}" is in <_get_chemical_annotations_to_exclude()>.',  # noqa
                        extra=EventLog(event_type='annotations').to_dict()
                    )
                elif lowered_word in self.exclusion_words:
                    current_app.logger.info(
                        f'Found a match in entity lookup but token "{token.keyword}" is a stop word.',  # noqa
                        extra=EventLog(event_type='annotations').to_dict()
                    )
                    current_app.logger.debug(
                        f'<entity_lookup_for_chemicals()> Found a match in entity lookup for "{token.keyword}". '  # noqa
                        f'But token "{token.keyword}" is in <annotation_stop_words> database table.',  # noqa
                        extra=EventLog(event_type='annotations').to_dict()
                    )
                else:
                    if token.keyword in self.matched_chemicals:
                        self.matched_chemicals[token.keyword].tokens.append(token)
                    else:
                        self.matched_chemicals[token.keyword] = LMDBMatch(entities=chem_val, tokens=[token])  # noqa

        return chem_val

    def entity_lookup_for_compounds(
        self,
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
            if nlp_predicted_type == EntityType.Compound.value:
                comp_val = self.lmdb_session.get_lmdb_values(
                    txn=self.lmdb_session.compounds_txn,
                    key=lookup_key,
                    token_type=EntityType.Compound.value
                )
            elif nlp_predicted_type is None:
                comp_val = self.lmdb_session.get_lmdb_values(
                    txn=self.lmdb_session.compounds_txn,
                    key=lookup_key,
                    token_type=EntityType.Compound.value
                )

            if not comp_val:
                # didn't find in LMDB so look in global inclusion
                comp_val = self.global_compound_inclusion.get(lookup_key, [])

            lowered_word = token.keyword.lower()

            if comp_val:
                if token.keyword in self._get_compound_annotations_to_exclude():
                    current_app.logger.info(
                        f'Found a match in entity lookup but token "{token.keyword}" is a global exclusion.',  # noqa
                        extra=EventLog(event_type='annotations').to_dict()
                    )
                    current_app.logger.debug(
                        f'<entity_lookup_for_compounds()> Found a match in entity lookup for "{token.keyword}". '  # noqa
                        f'But token "{token.keyword}" is in <_get_compound_annotations_to_exclude()>.',  # noqa
                        extra=EventLog(event_type='annotations').to_dict()
                    )
                elif lowered_word in self.exclusion_words:
                    current_app.logger.info(
                        f'Found a match in entity lookup but token "{token.keyword}" is a stop word.',  # noqa
                        extra=EventLog(event_type='annotations').to_dict()
                    )
                    current_app.logger.debug(
                        f'<entity_lookup_for_compounds()> Found a match in entity lookup for "{token.keyword}". '  # noqa
                        f'But token "{token.keyword}" is in <annotation_stop_words> database table.',  # noqa
                        extra=EventLog(event_type='annotations').to_dict()
                    )
                else:
                    if token.keyword in self.matched_compounds:
                        self.matched_compounds[token.keyword].tokens.append(token)
                    else:
                        self.matched_compounds[token.keyword] = LMDBMatch(entities=comp_val, tokens=[token])  # noqa

        return comp_val

    def entity_lookup_for_diseases(
        self,
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
            if nlp_predicted_type == EntityType.Disease.value:
                diseases_val = self.lmdb_session.get_lmdb_values(
                    txn=self.lmdb_session.diseases_txn,
                    key=lookup_key,
                    token_type=EntityType.Disease.value
                )
            elif nlp_predicted_type is None:
                diseases_val = self.lmdb_session.get_lmdb_values(
                    txn=self.lmdb_session.diseases_txn,
                    key=lookup_key,
                    token_type=EntityType.Disease.value
                )

            if not diseases_val:
                # didn't find in LMDB so look in global inclusion
                diseases_val = self.global_disease_inclusion.get(lookup_key, [])

            lowered_word = token.keyword.lower()

            if diseases_val:
                if token.keyword in self._get_disease_annotations_to_exclude():
                    current_app.logger.info(
                        f'Found a match in entity lookup but token "{token.keyword}" is a global exclusion.',  # noqa
                        extra=EventLog(event_type='annotations').to_dict()
                    )
                    current_app.logger.debug(
                        f'<entity_lookup_for_diseases()> Found a match in entity lookup for "{token.keyword}". '  # noqa
                        f'But token "{token.keyword}" is in <_get_disease_annotations_to_exclude()>.',  # noqa
                        extra=EventLog(event_type='annotations').to_dict()
                    )
                elif lowered_word in self.exclusion_words:
                    current_app.logger.info(
                        f'Found a match in entity lookup but token "{token.keyword}" is a stop word.',  # noqa
                        extra=EventLog(event_type='annotations').to_dict()
                    )
                    current_app.logger.debug(
                        f'<entity_lookup_for_diseases()> Found a match in entity lookup for "{token.keyword}". '  # noqa
                        f'But token "{token.keyword}" is in <annotation_stop_words> database table.',  # noqa
                        extra=EventLog(event_type='annotations').to_dict()
                    )
                else:
                    if token.keyword in self.matched_diseases:
                        self.matched_diseases[token.keyword].tokens.append(token)
                    else:
                        self.matched_diseases[token.keyword] = LMDBMatch(entities=diseases_val, tokens=[token])  # noqa

        return diseases_val

    def entity_lookup_for_genes(
        self,
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
            if nlp_predicted_type == EntityType.Gene.value:
                gene_val = self.lmdb_session.get_lmdb_values(
                    txn=self.lmdb_session.genes_txn,
                    key=lookup_key,
                    token_type=EntityType.Gene.value
                )
            elif nlp_predicted_type is None:
                gene_val = self.lmdb_session.get_lmdb_values(
                    txn=self.lmdb_session.genes_txn,
                    key=lookup_key,
                    token_type=EntityType.Gene.value
                )

            if not gene_val:
                # didn't find in LMDB so look in global inclusion
                gene_val = self.global_gene_inclusion.get(lookup_key, [])

            lowered_word = token.keyword.lower()

            if gene_val:
                if token.keyword in self._get_gene_annotations_to_exclude():
                    current_app.logger.info(
                        f'Found a match in entity lookup but token "{token.keyword}" is a global exclusion.',  # noqa
                        extra=EventLog(event_type='annotations').to_dict()
                    )
                    current_app.logger.debug(
                        f'<entity_lookup_for_genes()> Found a match in entity lookup for "{token.keyword}". '  # noqa
                        f'But token "{token.keyword}" is in <_get_gene_annotations_to_exclude()>.',  # noqa
                        extra=EventLog(event_type='annotations').to_dict()
                    )
                elif lowered_word in self.exclusion_words:
                    current_app.logger.info(
                        f'Found a match in entity lookup but token "{token.keyword}" is a stop word.',  # noqa
                        extra=EventLog(event_type='annotations').to_dict()
                    )
                    current_app.logger.debug(
                        f'<entity_lookup_for_genes()> Found a match in entity lookup for "{token.keyword}". '  # noqa
                        f'But token "{token.keyword}" is in <annotation_stop_words> database table.',  # noqa
                        extra=EventLog(event_type='annotations').to_dict()
                    )
                else:
                    if token.keyword in self.matched_genes:
                        self.matched_genes[token.keyword].tokens.append(token)
                    else:
                        self.matched_genes[token.keyword] = LMDBMatch(entities=gene_val, tokens=[token])  # noqa

        return gene_val

    def entity_lookup_for_phenotypes(
        self,
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
            if nlp_predicted_type == EntityType.Phenotype.value:
                phenotype_val = self.lmdb_session.get_lmdb_values(
                    txn=self.lmdb_session.phenotypes_txn,
                    key=lookup_key,
                    token_type=EntityType.Phenotype.value
                )
            elif nlp_predicted_type is None:
                phenotype_val = self.lmdb_session.get_lmdb_values(
                    txn=self.lmdb_session.phenotypes_txn,
                    key=lookup_key,
                    token_type=EntityType.Phenotype.value
                )

            if not phenotype_val:
                # didn't find in LMDB so look in global inclusion
                phenotype_val = self.global_phenotype_inclusion.get(lookup_key, [])

            lowered_word = token.keyword.lower()

            if phenotype_val:
                if token.keyword in self._get_phenotype_annotations_to_exclude():
                    current_app.logger.info(
                        f'Found a match in entity lookup but token "{token.keyword}" is a global exclusion.',  # noqa
                        extra=EventLog(event_type='annotations').to_dict()
                    )
                    current_app.logger.debug(
                        f'<entity_lookup_for_phenotypes()> Found a match in entity lookup for "{token.keyword}". '  # noqa
                        f'But token "{token.keyword}" is in <_get_phenotype_annotations_to_exclude()>.',  # noqa
                        extra=EventLog(event_type='annotations').to_dict()
                    )
                elif lowered_word in self.exclusion_words:
                    current_app.logger.info(
                        f'Found a match in entity lookup but token "{token.keyword}" is a stop word.',  # noqa
                        extra=EventLog(event_type='annotations').to_dict()
                    )
                    current_app.logger.debug(
                        f'<entity_lookup_for_phenotypes()> Found a match in entity lookup for "{token.keyword}". '  # noqa
                        f'But token "{token.keyword}" is in <annotation_stop_words> database table.',  # noqa
                        extra=EventLog(event_type='annotations').to_dict()
                    )
                else:
                    if token.keyword in self.matched_phenotypes:
                        self.matched_phenotypes[token.keyword].tokens.append(token)
                    else:
                        self.matched_phenotypes[token.keyword] = LMDBMatch(entities=phenotype_val, tokens=[token])  # noqa

        return phenotype_val

    def entity_lookup_for_proteins(
        self,
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
            if nlp_predicted_type == EntityType.Protein.value:
                protein_val = self.lmdb_session.get_lmdb_values(
                    txn=self.lmdb_session.proteins_txn,
                    key=lookup_key,
                    token_type=EntityType.Protein.value
                )
            elif nlp_predicted_type is None:
                protein_val = self.lmdb_session.get_lmdb_values(
                    txn=self.lmdb_session.proteins_txn,
                    key=lookup_key,
                    token_type=EntityType.Protein.value
                )

            if protein_val:
                entities_to_use = [entity for entity in protein_val if entity['synonym'] == token.keyword]  # noqa
                if entities_to_use:
                    protein_val = entities_to_use

            if not protein_val:
                # didn't find in LMDB so look in global inclusion
                protein_val = self.global_protein_inclusion.get(lookup_key, [])

            lowered_word = token.keyword.lower()

            if protein_val:
                if token.keyword in self._get_protein_annotations_to_exclude():
                    current_app.logger.info(
                        f'Found a match in entity lookup but token "{token.keyword}" is a global exclusion.',  # noqa
                        extra=EventLog(event_type='annotations').to_dict()
                    )
                    current_app.logger.debug(
                        f'<entity_lookup_for_proteins()> Found a match in entity lookup for "{token.keyword}". '  # noqa
                        f'But token "{token.keyword}" is in <_get_protein_annotations_to_exclude()>.',  # noqa
                        extra=EventLog(event_type='annotations').to_dict()
                    )
                elif lowered_word in self.exclusion_words:
                    current_app.logger.info(
                        f'Found a match in entity lookup but token "{token.keyword}" is a stop word.',  # noqa
                        extra=EventLog(event_type='annotations').to_dict()
                    )
                    current_app.logger.debug(
                        f'<entity_lookup_for_proteins()> Found a match in entity lookup for "{token.keyword}". '  # noqa
                        f'But token "{token.keyword}" is in <annotation_stop_words> database table.',  # noqa
                        extra=EventLog(event_type='annotations').to_dict()
                    )
                else:
                    if token.keyword in self.matched_proteins:
                        self.matched_proteins[token.keyword].tokens.append(token)
                    else:
                        self.matched_proteins[token.keyword] = LMDBMatch(entities=protein_val, tokens=[token])  # noqa

        return protein_val

    def entity_lookup_for_species(
        self,
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
            # check species
            # TODO: Bacteria because for now NLP has that instead of
            # generic `Species`
            if nlp_predicted_type == EntityType.Species.value or nlp_predicted_type == 'Bacteria':  # noqa
                species_val = self.lmdb_session.get_lmdb_values(
                    txn=self.lmdb_session.species_txn,
                    key=lookup_key,
                    token_type=EntityType.Species.value
                )
            elif nlp_predicted_type is None:
                species_val = self.lmdb_session.get_lmdb_values(
                    txn=self.lmdb_session.species_txn,
                    key=lookup_key,
                    token_type=EntityType.Species.value
                )

            if not species_val:
                # didn't find in LMDB so look in global inclusion
                species_val = self.global_species_inclusion.get(lookup_key, [])

            lowered_word = token.keyword.lower()
            global_exclusion = self._get_species_annotations_to_exclude()

            if species_val or lookup_key in self.local_species_inclusion:  # noqa
                if token.keyword in global_exclusion:
                    current_app.logger.info(
                        f'Found a match in entity lookup but token "{token.keyword}" is a global exclusion.',  # noqa
                        extra=EventLog(event_type='annotations').to_dict()
                    )
                    current_app.logger.debug(
                        f'<entity_lookup_for_species()> Found a match in entity lookup for "{token.keyword}". '  # noqa
                        f'But token "{token.keyword}" is in <_get_species_annotations_to_exclude()>.',  # noqa
                        extra=EventLog(event_type='annotations').to_dict()
                    )
                elif lowered_word in SPECIES_EXCLUSION:
                    current_app.logger.info(
                        f'Found a match in entity lookup but token "{token.keyword}" is a stop word.',  # noqa
                        extra=EventLog(event_type='annotations').to_dict()
                    )
                    current_app.logger.debug(
                        f'<entity_lookup_for_species()> Found a match in entity lookup for "{token.keyword}". '  # noqa
                        f'But token "{token.keyword}" is in <{SPECIES_EXCLUSION}>.',  # noqa
                        extra=EventLog(event_type='annotations').to_dict()
                    )
                else:
                    # for LMDB and global inclusions, add to same dict
                    # for local inclusions use separate
                    #
                    # TODO: can it be both?
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
    ) -> None:
        if check_entities.get(EntityType.Chemical.value, False):
            self._find_chemical_match(token)

        if check_entities.get(EntityType.Compound.value, False):
            self._find_compound_match(token)

        if check_entities.get(EntityType.Disease.value, False):
            self._find_disease_match(token)

        if check_entities.get(EntityType.Gene.value, False):
            self._find_gene_match(token)

        if check_entities.get(EntityType.Phenotype.value, False):
            self._find_phenotype_match(token)

        if check_entities.get(EntityType.Protein.value, False):
            self._find_protein_match(token)

        if check_entities.get(EntityType.Species.value, False):
            self._find_species_match(token)

    def _find_chemical_match(self, token: PDFTokenPositions) -> None:
        word = token.keyword
        if word:
            if word in COMMON_TYPOS:
                for correct_spelling in COMMON_TYPOS[word]:
                    exist = self.entity_lookup_for_chemicals(
                        token=token,
                        synonym=correct_spelling,
                    )

                    # if any that means there was a match
                    if exist is not None:
                        break
            else:
                self.entity_lookup_for_chemicals(
                    token=token,
                )

    def _find_compound_match(self, token: PDFTokenPositions) -> None:
        word = token.keyword
        if word:
            if word in COMMON_TYPOS:
                for correct_spelling in COMMON_TYPOS[word]:
                    exist = self.entity_lookup_for_compounds(
                        token=token,
                        synonym=correct_spelling,
                    )

                    # if any that means there was a match
                    if exist is not None:
                        break
            else:
                self.entity_lookup_for_compounds(
                    token=token,
                )

    def _find_disease_match(self, token: PDFTokenPositions) -> None:
        word = token.keyword
        if word:
            if word in COMMON_TYPOS:
                for correct_spelling in COMMON_TYPOS[word]:
                    exist = self.entity_lookup_for_diseases(
                        token=token,
                        synonym=correct_spelling,
                    )

                    # if any that means there was a match
                    if exist is not None:
                        break
            else:
                self.entity_lookup_for_diseases(
                    token=token,
                )

    def _find_gene_match(self, token: PDFTokenPositions) -> None:
        word = token.keyword
        if word:
            if word in COMMON_TYPOS:
                for correct_spelling in COMMON_TYPOS[word]:
                    exist = self.entity_lookup_for_genes(
                        token=token,
                        synonym=correct_spelling,
                    )

                    # if any that means there was a match
                    if exist is not None:
                        break
            else:
                self.entity_lookup_for_genes(
                    token=token,
                )

    def _find_phenotype_match(self, token: PDFTokenPositions) -> None:
        word = token.keyword
        if word:
            if word in COMMON_TYPOS:
                for correct_spelling in COMMON_TYPOS[word]:
                    exist = self.entity_lookup_for_phenotypes(
                        token=token,
                        synonym=correct_spelling,
                    )

                    # if any that means there was a match
                    if exist is not None:
                        break
            else:
                self.entity_lookup_for_phenotypes(
                    token=token,
                )

    def _find_protein_match(self, token: PDFTokenPositions) -> None:
        word = token.keyword
        if word:
            if word in COMMON_TYPOS:
                for correct_spelling in COMMON_TYPOS[word]:
                    exist = self.entity_lookup_for_proteins(
                        token=token,
                        synonym=correct_spelling,
                    )

                    # if any that means there was a match
                    if exist is not None:
                        break
            else:
                self.entity_lookup_for_proteins(
                    token=token,
                )

    def _find_species_match(self, token: PDFTokenPositions) -> None:
        word = token.keyword
        if word:
            if word in COMMON_TYPOS:
                for correct_spelling in COMMON_TYPOS[word]:
                    exist = self.entity_lookup_for_species(
                        token=token,
                        synonym=correct_spelling,
                    )

                    # if any that means there was a match
                    if exist is not None:
                        break
            else:
                self.entity_lookup_for_species(
                    token=token,
                )

    def set_entity_inclusions(
        self,
        custom_annotations: List[dict],
    ) -> None:
        self._set_local_species_inclusion(custom_annotations)
        deque(starmap(self._set_global_inclusions, self._get_global_inclusion_pairs()), maxlen=0)  # noqa

    def identify_entities(
        self,
        tokens: List[PDFTokenPositions],
        check_entities_in_lmdb: Dict[str, bool],
    ) -> None:
        deque(map(partial(self._entity_lookup_dispatch, check_entities=check_entities_in_lmdb), tokens), maxlen=0)  # noqa
