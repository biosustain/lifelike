import json
import re
import requests

from collections import deque
from math import inf
from functools import partial
from itertools import starmap
from typing import cast, Any, Dict, List, Optional, Set, Tuple, Union
from uuid import uuid4

from flask import current_app
from pdfminer.layout import LTAnno, LTChar
from sqlalchemy import and_

from .annotation_interval_tree import (
    AnnotationInterval,
    AnnotationIntervalTree,
)
from .annotations_neo4j_service import AnnotationsNeo4jService
from .constants import (
    DatabaseType,
    EntityColor,
    EntityIdStr,
    EntityType,
    ManualAnnotationType,
    OrganismCategory,
    # exclusion lists
    # CHEMICAL_EXCLUSION,
    # COMPOUND_EXCLUSION,
    SPECIES_EXCLUSION,
    # end exclusion lists
    ENTITY_HYPERLINKS,
    ENTITY_TYPE_PRECEDENCE,
    GOOGLE_LINK,
    HOMO_SAPIENS_TAX_ID,
    NCBI_LINK,
    PDF_NEW_LINE_THRESHOLD,
    COMMON_TYPOS,
    UNIPROT_LINK,
    WIKIPEDIA_LINK,
    NLP_ENDPOINT,
)
from .lmdb_dao import LMDBDao
from .util import (
    create_chemical_for_ner,
    create_compound_for_ner,
    create_disease_for_ner,
    create_gene_for_ner,
    create_phenotype_for_ner,
    create_protein_for_ner,
    create_species_for_ner,
    normalize_str,
    standardize_str,
)

from neo4japp.data_transfer_objects import (
    Annotation,
    GeneAnnotation,
    LMDBMatch,
    OrganismAnnotation,
    PDFParsedCharacters,
    PDFTokenPositions,
    PDFTokenPositionsList,
)
from neo4japp.exceptions import AnnotationError
from neo4japp.models import AnnotationStopWords, GlobalList
from neo4japp.utils.logger import EventLog


class AnnotationsService:
    def __init__(
        self,
        lmdb_session: LMDBDao,
        annotation_neo4j: AnnotationsNeo4jService,
    ) -> None:
        self.lmdb_session = lmdb_session
        self.annotation_neo4j = annotation_neo4j

        # for word tokens that are typos
        self.correct_spellings: Dict[str, str] = {}

        # for the global and local, structured the same as LMDB
        self.local_species_inclusion: Dict[str, List[dict]] = {}
        self.global_chemical_inclusion: Dict[str, List[dict]] = {}
        self.global_compound_inclusion: Dict[str, List[dict]] = {}
        self.global_disease_inclusion: Dict[str, List[dict]] = {}
        self.global_gene_inclusion: Dict[str, List[dict]] = {}
        self.global_phenotype_inclusion: Dict[str, List[dict]] = {}
        self.global_protein_inclusion: Dict[str, List[dict]] = {}
        self.global_species_inclusion: Dict[str, List[dict]] = {}

        self.matched_genes: Dict[str, LMDBMatch] = {}
        self.matched_chemicals: Dict[str, LMDBMatch] = {}
        self.matched_compounds: Dict[str, LMDBMatch] = {}
        self.matched_proteins: Dict[str, LMDBMatch] = {}
        self.matched_species: Dict[str, LMDBMatch] = {}
        self.matched_diseases: Dict[str, LMDBMatch] = {}
        self.matched_phenotypes: Dict[str, LMDBMatch] = {}

        self.matched_local_species_inclusion: Dict[str, List[PDFTokenPositions]] = {}

        self.organism_frequency: Dict[str, int] = {}
        self.organism_locations: Dict[str, List[Tuple[int, int]]] = {}
        self.organism_categories: Dict[str, str] = {}

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

    def _get_chemical_annotations_to_exclude(self):
        return set(
            exclusion.get('text') for exclusion in self.global_annotations_to_exclude if
                exclusion.get('type') == EntityType.CHEMICAL.value and exclusion.get('text'))  # noqa

    def _get_compound_annotations_to_exclude(self):
        return set(
            exclusion.get('text') for exclusion in self.global_annotations_to_exclude if
                exclusion.get('type') == EntityType.COMPOUND.value and exclusion.get('text'))  # noqa

    def _get_disease_annotations_to_exclude(self):
        return set(
            exclusion.get('text') for exclusion in self.global_annotations_to_exclude if
                exclusion.get('type') == EntityType.DISEASE.value and exclusion.get('text'))  # noqa

    def _get_gene_annotations_to_exclude(self):
        return set(
            exclusion.get('text') for exclusion in self.global_annotations_to_exclude if
                exclusion.get('type') == EntityType.GENE.value and exclusion.get('text'))  # noqa

    def _get_phenotype_annotations_to_exclude(self):
        return set(
            exclusion.get('text') for exclusion in self.global_annotations_to_exclude if
                exclusion.get('type') == EntityType.PHENOTYPE.value and exclusion.get('text'))  # noqa

    def _get_protein_annotations_to_exclude(self):
        return set(
            exclusion.get('text') for exclusion in self.global_annotations_to_exclude if
                exclusion.get('type') == EntityType.PROTEIN.value and exclusion.get('text'))  # noqa

    def _get_species_annotations_to_exclude(self):
        return set(
            exclusion.get('text') for exclusion in self.global_annotations_to_exclude if
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
            if nlp_predicted_type == EntityType.CHEMICAL.value:
                chem_val = self.lmdb_session.get_lmdb_values(
                    txn=self.lmdb_session.chemicals_txn,
                    key=lookup_key,
                    token_type=EntityType.CHEMICAL.value
                )
            elif nlp_predicted_type is None:
                chem_val = self.lmdb_session.get_lmdb_values(
                    txn=self.lmdb_session.chemicals_txn,
                    key=lookup_key,
                    token_type=EntityType.CHEMICAL.value
                )

            if not chem_val:
                # didn't find in LMDB so look in global inclusion
                chem_val = self.global_chemical_inclusion.get(lookup_key, [])

            lowered_word = token.keyword.lower()
            global_exclusion = self._get_chemical_annotations_to_exclude()

            if chem_val:
                if token.keyword in global_exclusion:
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
            if nlp_predicted_type == EntityType.COMPOUND.value:
                comp_val = self.lmdb_session.get_lmdb_values(
                    txn=self.lmdb_session.compounds_txn,
                    key=lookup_key,
                    token_type=EntityType.COMPOUND.value
                )
            elif nlp_predicted_type is None:
                comp_val = self.lmdb_session.get_lmdb_values(
                    txn=self.lmdb_session.compounds_txn,
                    key=lookup_key,
                    token_type=EntityType.COMPOUND.value
                )

            if not comp_val:
                # didn't find in LMDB so look in global inclusion
                comp_val = self.global_compound_inclusion.get(lookup_key, [])

            lowered_word = token.keyword.lower()
            global_exclusion = self._get_compound_annotations_to_exclude()

            if comp_val:
                if token.keyword in global_exclusion:
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
            if nlp_predicted_type == EntityType.DISEASE.value:
                diseases_val = self.lmdb_session.get_lmdb_values(
                    txn=self.lmdb_session.diseases_txn,
                    key=lookup_key,
                    token_type=EntityType.DISEASE.value
                )
            elif nlp_predicted_type is None:
                diseases_val = self.lmdb_session.get_lmdb_values(
                    txn=self.lmdb_session.diseases_txn,
                    key=lookup_key,
                    token_type=EntityType.DISEASE.value
                )

            if not diseases_val:
                # didn't find in LMDB so look in global inclusion
                diseases_val = self.global_disease_inclusion.get(lookup_key, [])

            lowered_word = token.keyword.lower()
            global_exclusion = self._get_disease_annotations_to_exclude()

            if diseases_val:
                if token.keyword in global_exclusion:
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
            if nlp_predicted_type == EntityType.GENE.value:
                gene_val = self.lmdb_session.get_lmdb_values(
                    txn=self.lmdb_session.genes_txn,
                    key=lookup_key,
                    token_type=EntityType.GENE.value
                )
            elif nlp_predicted_type is None:
                gene_val = self.lmdb_session.get_lmdb_values(
                    txn=self.lmdb_session.genes_txn,
                    key=lookup_key,
                    token_type=EntityType.GENE.value
                )

            if not gene_val:
                # didn't find in LMDB so look in global inclusion
                gene_val = self.global_gene_inclusion.get(lookup_key, [])

            lowered_word = token.keyword.lower()
            global_exclusion = self._get_gene_annotations_to_exclude()

            if gene_val:
                if token.keyword in global_exclusion:
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

    def validate_phenotypes_lmdb(
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
            if nlp_predicted_type == EntityType.PHENOTYPE.value:
                phenotype_val = self.lmdb_session.get_lmdb_values(
                    txn=self.lmdb_session.phenotypes_txn,
                    key=lookup_key,
                    token_type=EntityType.PHENOTYPE.value
                )
            elif nlp_predicted_type is None:
                phenotype_val = self.lmdb_session.get_lmdb_values(
                    txn=self.lmdb_session.phenotypes_txn,
                    key=lookup_key,
                    token_type=EntityType.PHENOTYPE.value
                )

            if not phenotype_val:
                # didn't find in LMDB so look in global inclusion
                phenotype_val = self.global_phenotype_inclusion.get(lookup_key, [])

            lowered_word = token.keyword.lower()
            global_exclusion = self._get_phenotype_annotations_to_exclude()

            if phenotype_val:
                if token.keyword in global_exclusion:
                    current_app.logger.info(
                        f'Found a match in entity lookup but token "{token.keyword}" is a global exclusion.',  # noqa
                        extra=EventLog(event_type='annotations').to_dict()
                    )
                    current_app.logger.debug(
                        f'<validate_phenotypes_lmdb()> Found a match in entity lookup for "{token.keyword}". '  # noqa
                        f'But token "{token.keyword}" is in <_get_phenotype_annotations_to_exclude()>.',  # noqa
                        extra=EventLog(event_type='annotations').to_dict()
                    )
                elif lowered_word in self.exclusion_words:
                    current_app.logger.info(
                        f'Found a match in entity lookup but token "{token.keyword}" is a stop word.',  # noqa
                        extra=EventLog(event_type='annotations').to_dict()
                    )
                    current_app.logger.debug(
                        f'<validate_phenotypes_lmdb()> Found a match in entity lookup for "{token.keyword}". '  # noqa
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
            if nlp_predicted_type == EntityType.PROTEIN.value:
                protein_val = self.lmdb_session.get_lmdb_values(
                    txn=self.lmdb_session.proteins_txn,
                    key=lookup_key,
                    token_type=EntityType.PROTEIN.value
                )
            elif nlp_predicted_type is None:
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

            lowered_word = token.keyword.lower()
            global_exclusion = self._get_protein_annotations_to_exclude()

            if protein_val:
                if token.keyword in global_exclusion:
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

    def _find_lmdb_match(
        self,
        token: PDFTokenPositions,
        check_entities: Dict[str, bool],
    ) -> None:
        if check_entities.get(EntityType.CHEMICAL.value, False):
            self._find_chemical_match(token)

        if check_entities.get(EntityType.COMPOUND.value, False):
            self._find_compound_match(token)

        if check_entities.get(EntityType.DISEASE.value, False):
            self._find_disease_match(token)

        if check_entities.get(EntityType.GENE.value, False):
            self._find_gene_match(token)

        if check_entities.get(EntityType.PHENOTYPE.value, False):
            self._find_phenotype_match(token)

        if check_entities.get(EntityType.PROTEIN.value, False):
            self._find_protein_match(token)

        if check_entities.get(EntityType.SPECIES.value, False):
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
                    exist = self.validate_phenotypes_lmdb(
                        token=token,
                        synonym=correct_spelling,
                    )

                    # if any that means there was a match
                    if exist is not None:
                        break
            else:
                self.validate_phenotypes_lmdb(
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

    def _create_keyword_objects(
        self,
        curr_page_coor_obj: List[Union[LTChar, LTAnno]],
        indexes: List[int],
        cropbox: Tuple[int, int],
        keyword_positions: List[Annotation.TextPosition] = [],
    ) -> None:
        """Creates the keyword objects with the keyword
        text, along with their coordinate positions and
        page number.

        Determines whether a part of the keyword is on a
        new line or not. If it is on a new line, then
        create a new coordinate object for that part of the keyword.

        E.g
            E. \nColi -> [
                {keyword: 'E.', x: ..., ...}, keyword: 'Coli', x: ..., ...}
            ]

            E. Coli -> [{keyword: 'E. Coli', x: ..., ...}]
        """
        def _skip_lt_anno(
            curr_page_coor_obj: List[Union[LTChar, LTAnno]],
            pos_idx: int,
        ) -> int:
            i = pos_idx
            while i >= 0 and isinstance(curr_page_coor_obj[i], LTAnno):
                i -= 1
            return i

        start_lower_x = None
        start_lower_y = None
        end_upper_x = None
        end_upper_y = None

        keyword = ''
        for i, pos_idx in enumerate(indexes):
            try:
                if isinstance(curr_page_coor_obj[pos_idx], LTChar):
                    lower_x, lower_y, upper_x, upper_y = curr_page_coor_obj[pos_idx].bbox  # noqa

                    if (start_lower_x is None and
                            start_lower_y is None and
                            end_upper_x is None and
                            end_upper_y is None):
                        start_lower_x = lower_x
                        start_lower_y = lower_y
                        end_upper_x = upper_x
                        end_upper_y = upper_y

                        keyword += curr_page_coor_obj[pos_idx].get_text()
                    else:
                        if lower_y != start_lower_y:
                            diff = abs(lower_y - start_lower_y)
                            prev_idx = _skip_lt_anno(
                                curr_page_coor_obj=curr_page_coor_obj,
                                pos_idx=pos_idx-1,
                            )
                            height = curr_page_coor_obj[prev_idx].height

                            # if diff is greater than height ratio
                            # then part of keyword is on a new line
                            if diff > height * PDF_NEW_LINE_THRESHOLD:
                                self._create_keyword_objects(
                                    curr_page_coor_obj=curr_page_coor_obj,
                                    indexes=indexes[i:],
                                    keyword_positions=keyword_positions,
                                    cropbox=cropbox,
                                )
                                break
                            else:
                                if upper_y > end_upper_y:
                                    end_upper_y = upper_y

                                if upper_x > end_upper_x:
                                    end_upper_x = upper_x

                                keyword += curr_page_coor_obj[pos_idx].get_text()
                        else:
                            if upper_y > end_upper_y:
                                end_upper_y = upper_y

                            if upper_x > end_upper_x:
                                end_upper_x = upper_x

                            keyword += curr_page_coor_obj[pos_idx].get_text()
            except IndexError:
                raise AnnotationError(
                    'An indexing error occurred when creating annotation keyword objects.')
            except Exception:
                raise AnnotationError(
                    'Unexpected error when creating annotation keyword objects')

        start_lower_x += cropbox[0]  # type: ignore
        end_upper_x += cropbox[0]  # type: ignore
        start_lower_y += cropbox[1]  # type: ignore
        end_upper_y += cropbox[1]  # type: ignore

        keyword_positions.append(
            Annotation.TextPosition(
                value=keyword,
                positions=[
                    start_lower_x, start_lower_y, end_upper_x, end_upper_y],  # type: ignore
            )
        )

    def _create_annotation_object(
        self,
        token_positions: PDFTokenPositions,
        char_coord_objs_in_pdf: List[Union[LTChar, LTAnno]],
        cropbox_in_pdf: Tuple[int, int],
        token_type: str,
        entity: dict,
        entity_id: str,
        entity_category: str,
        color: str,
    ) -> Annotation:
        curr_page_coor_obj = char_coord_objs_in_pdf
        cropbox = cropbox_in_pdf

        keyword_positions: List[Annotation.TextPosition] = []
        char_indexes = list(token_positions.char_positions.keys())

        self._create_keyword_objects(
            curr_page_coor_obj=curr_page_coor_obj,
            indexes=char_indexes,
            keyword_positions=keyword_positions,
            cropbox=cropbox,
        )

        # entity here is data structure from LMDB
        # see services/annotations/util.py for definition
        keyword_starting_idx = char_indexes[0]
        keyword_ending_idx = char_indexes[-1]
        link_search_term = entity['synonym']
        if entity['id_type'] != DatabaseType.NCBI.value:
            hyperlink = ENTITY_HYPERLINKS[entity['id_type']]
        else:
            # type ignore, see https://github.com/python/mypy/issues/8277
            hyperlink = ENTITY_HYPERLINKS[entity['id_type']][token_type]  # type: ignore

        if entity['id_type'] == DatabaseType.MESH.value:
            hyperlink += entity_id[5:]  # type: ignore
        else:
            hyperlink += entity_id  # type: ignore

        if token_type == EntityType.SPECIES.value:
            organism_meta = OrganismAnnotation.OrganismMeta(
                category=entity_category,
                type=token_type,
                color=color,
                id=entity_id,
                id_type=entity['id_type'],
                id_hyperlink=cast(str, hyperlink),
                links=OrganismAnnotation.OrganismMeta.Links(
                    ncbi=NCBI_LINK + link_search_term,
                    uniprot=UNIPROT_LINK + link_search_term,
                    wikipedia=WIKIPEDIA_LINK + link_search_term,
                    google=GOOGLE_LINK + link_search_term,
                ),
                all_text=link_search_term,
            )
            # the `keywords` property here is to allow us to know
            # what coordinates map to what text in the PDF
            # we want to actually use the real name inside LMDB
            # for the `keyword` property
            annotation = OrganismAnnotation(
                page_number=token_positions.page_number,
                rects=[pos.positions for pos in keyword_positions],  # type: ignore
                keywords=[k.value for k in keyword_positions],
                keyword=link_search_term,
                text_in_document=token_positions.keyword,
                keyword_length=len(token_positions.keyword),
                lo_location_offset=keyword_starting_idx,
                hi_location_offset=keyword_ending_idx,
                meta=organism_meta,
                uuid=str(uuid4()),
            )
        elif token_type == EntityType.GENE.value:
            gene_meta = GeneAnnotation.GeneMeta(
                category=entity_category,
                type=token_type,
                color=color,
                id=entity_id,
                id_type=entity['id_type'],
                id_hyperlink=cast(str, hyperlink),
                links=OrganismAnnotation.OrganismMeta.Links(
                    ncbi=NCBI_LINK + link_search_term,
                    uniprot=UNIPROT_LINK + link_search_term,
                    wikipedia=WIKIPEDIA_LINK + link_search_term,
                    google=GOOGLE_LINK + link_search_term,
                ),
                all_text=link_search_term,
            )
            annotation = GeneAnnotation(
                page_number=token_positions.page_number,
                rects=[pos.positions for pos in keyword_positions],  # type: ignore
                keywords=[k.value for k in keyword_positions],
                keyword=link_search_term,
                text_in_document=token_positions.keyword,
                keyword_length=len(token_positions.keyword),
                lo_location_offset=keyword_starting_idx,
                hi_location_offset=keyword_ending_idx,
                meta=gene_meta,
                uuid=str(uuid4()),
            )
        else:
            meta = Annotation.Meta(
                type=token_type,
                color=color,
                id=entity_id,
                id_type=entity['id_type'],
                id_hyperlink=cast(str, hyperlink),
                links=Annotation.Meta.Links(
                    ncbi=NCBI_LINK + link_search_term,
                    uniprot=UNIPROT_LINK + link_search_term,
                    wikipedia=WIKIPEDIA_LINK + link_search_term,
                    google=GOOGLE_LINK + link_search_term,
                ),
                all_text=link_search_term,
            )
            annotation = Annotation(
                page_number=token_positions.page_number,
                rects=[pos.positions for pos in keyword_positions],  # type: ignore
                keywords=[k.value for k in keyword_positions],
                keyword=link_search_term,
                text_in_document=token_positions.keyword,
                keyword_length=len(token_positions.keyword),
                lo_location_offset=keyword_starting_idx,
                hi_location_offset=keyword_ending_idx,
                meta=meta,
                uuid=str(uuid4()),
            )
        return annotation

    def _get_annotation(
        self,
        tokens: Dict[str, LMDBMatch],
        token_type: str,
        color: str,
        id_str: str,
        char_coord_objs_in_pdf: List[Union[LTChar, LTAnno]],
        cropbox_in_pdf: Tuple[int, int],
    ) -> List[Annotation]:
        """Create annotation objects for tokens.

        Assumption:
            - An entity in LMDB will always have a common name and synonym
                (1) this means a common name will have itself as a synonym

        Algorithm:
            - Normalize the tokens and consider correct spelling
            - Handle common synonyms across multiple common names, because
              cannot infer entity.
                (1) if none of the common names appears, then ignore synonym
                (2) if more than one common name appears, then ignore synonym
                (3) if only one common name appears, identify synonym as entity of common name
            - NOTE: The above DOES NOT apply to synonyms that HAVE ONLY ONE common name
                (1) so if a synonym appears but its common name does not, the synonym
                will be in annotations

            - TODO: Considerations:
                (1) A synonym that is also a common name, and the other common name appears
                    (1a) how to handle? Currently ignore synonym because can't infer (?)

        Returns list of matched annotations
        """
        matches: List[Annotation] = []
        tokens_lowercased = set([normalize_str(s) for s in list(tokens.keys())])

        for word, lmdb_match in tokens.items():
            for token_positions in lmdb_match.tokens:
                synonym_common_names_dict: Dict[str, Set[str]] = {}

                for entity in lmdb_match.entities:
                    entity_synonym = entity['synonym']
                    entity_common_name = entity['name']
                    if entity_synonym in synonym_common_names_dict:
                        synonym_common_names_dict[entity_synonym].add(normalize_str(entity_common_name))  # noqa
                    else:
                        synonym_common_names_dict[entity_synonym] = {normalize_str(entity_common_name)}  # noqa

                for entity in lmdb_match.entities:
                    entity_synonym = entity['synonym']
                    common_names_referenced_by_synonym = synonym_common_names_dict[entity_synonym]
                    if len(common_names_referenced_by_synonym) > 1:
                        # synonym used by multiple different common names
                        #
                        # for synonyms that are used by more than one common names
                        # if none of those common names appear in the document
                        # or if more than one of those common names appear in the document
                        # do not annotate because cannot infer
                        common_names_in_document = [n for n in common_names_referenced_by_synonym if n in tokens_lowercased]  # noqa

                        if len(common_names_in_document) != 1:
                            continue

                    annotation = self._create_annotation_object(
                        char_coord_objs_in_pdf=char_coord_objs_in_pdf,
                        cropbox_in_pdf=cropbox_in_pdf,
                        token_positions=token_positions,
                        token_type=token_type,
                        entity=entity,
                        entity_id=entity[id_str],
                        entity_category=entity.get('category', ''),
                        color=color,
                    )
                    matches.append(annotation)
        return matches

    def _get_closest_gene_organism_pair(
        self,
        gene_position: PDFTokenPositions,
        organism_matches: Dict[str, str],
    ) -> Tuple[str, str]:
        """Gets the correct gene/organism pair for a given gene and its list of matching organisms.

        A gene name may match multiple organisms. To choose which organism to use, we first
        check for the closest one in the document. If two organisms are equal in distance,
        we choose the one that appears most frequently in the document. If the two organisms
        are both equidistant and equally frequent, we always prefer homo sapiens if it is
        either of the two genes. Otherwise, we choose the one we matched first.
        """

        char_indexes = list(gene_position.char_positions.keys())
        gene_location_lo = char_indexes[0]
        gene_location_hi = char_indexes[-1]

        closest_dist = inf
        curr_closest_organism = None

        for organism in organism_matches:
            if self.organism_locations.get(organism, None) is None and self.organism_frequency.get(organism, None) is None:  # noqa
                raise AnnotationError(f'Organism ID {organism} does not exist, potential key error.')  # noqa

            if curr_closest_organism is None:
                curr_closest_organism = organism

            min_organism_dist = inf

            # Get the closest instance of this organism
            for organism_pos in self.organism_locations[organism]:
                organism_location_lo = organism_pos[0]
                organism_location_hi = organism_pos[1]

                if gene_location_lo > organism_location_hi:
                    new_organism_dist = gene_location_lo - organism_location_hi
                else:
                    new_organism_dist = organism_location_lo - gene_location_hi

                if new_organism_dist < min_organism_dist:
                    min_organism_dist = new_organism_dist

            # If this organism is closer than the current closest, update
            if min_organism_dist < closest_dist:
                curr_closest_organism = organism
                closest_dist = min_organism_dist
            # If this organism is equidistant to the current closest, check frequency instead
            elif min_organism_dist == closest_dist:
                # If the frequency of this organism is greater, update
                if self.organism_frequency[organism] > self.organism_frequency[curr_closest_organism]:  # noqa
                    curr_closest_organism = organism
                elif self.organism_frequency[organism] == self.organism_frequency[curr_closest_organism]:  # noqa
                    # If the organisms are equidistant and equal frequency,
                    # check if the new organism is human, and if so update
                    if organism == HOMO_SAPIENS_TAX_ID:
                        curr_closest_organism = organism

        if curr_closest_organism is None:
            raise ValueError('Cannot get gene ID with empty organism match dict.')

        # Return the gene id of the organism with the highest priority
        return organism_matches[curr_closest_organism], curr_closest_organism

    def _annotate_genes(
        self,
        entity_id_str: str,
        char_coord_objs_in_pdf: List[Union[LTChar, LTAnno]],
        cropbox_in_pdf: Tuple[int, int],
    ) -> List[Annotation]:
        """Gene specific annotation. Nearly identical to `_get_annotation`,
        except that we check genes against the matched organisms found in the
        document.

        It is likely that the annotator will detect keywords that resemble gene
        names, but are not genes in the context of the document.

        It is also possible that two organisms discussed in the document each have a
        gene with the same name. In this case we need a way to distinguish between the
        two.

        To resolve both of the above issues we check the graph database for
        relationships between genes/organisms, and handle each of the following cases:
            1. Exactly one organism match for a given gene
            2. More than one organism match for a given gene
            3. No organism matches for a given gene

        Returns list of matched annotations
        """
        tokens: Dict[str, LMDBMatch] = self.matched_genes

        matches: List[Annotation] = []

        entity_tokenpos_pairs = []
        gene_names: Set[str] = set()
        for word, lmdb_match in tokens.items():
            for token_positions in lmdb_match.tokens:
                for entity in lmdb_match.entities:
                    entity_synonym = entity['name'] if entity.get('inclusion', None) else entity['synonym']  # noqa
                    gene_names.add(entity_synonym)

                    entity_tokenpos_pairs.append((entity, token_positions))

        gene_organism_matches = \
            self.annotation_neo4j.get_gene_to_organism_match_result(
                genes=list(gene_names),
                matched_organism_ids=list(self.organism_frequency.keys()),
            )

        for entity, token_positions in entity_tokenpos_pairs:
            entity_synonym = entity['name'] if entity.get('inclusion', None) else entity['synonym']  # noqa
            if entity_synonym in gene_organism_matches:
                gene_id, organism_id = self._get_closest_gene_organism_pair(
                    gene_position=token_positions,
                    organism_matches=gene_organism_matches[entity_synonym]
                )

                category = self.organism_categories[organism_id]

                annotation = self._create_annotation_object(
                    char_coord_objs_in_pdf=char_coord_objs_in_pdf,
                    cropbox_in_pdf=cropbox_in_pdf,
                    token_positions=token_positions,
                    token_type=EntityType.GENE.value,
                    entity=entity,
                    entity_id=gene_id,
                    entity_category=category,
                    color=EntityColor.GENE.value,
                )
                matches.append(annotation)
        return matches

    def _annotate_chemicals(
        self,
        entity_id_str: str,
        char_coord_objs_in_pdf: List[Union[LTChar, LTAnno]],
        cropbox_in_pdf: Tuple[int, int],
    ) -> List[Annotation]:
        return self._get_annotation(
            tokens=self.matched_chemicals,
            token_type=EntityType.CHEMICAL.value,
            color=EntityColor.CHEMICAL.value,
            id_str=entity_id_str,
            char_coord_objs_in_pdf=char_coord_objs_in_pdf,
            cropbox_in_pdf=cropbox_in_pdf,
        )

    def _annotate_compounds(
        self,
        entity_id_str: str,
        char_coord_objs_in_pdf: List[Union[LTChar, LTAnno]],
        cropbox_in_pdf: Tuple[int, int],
    ) -> List[Annotation]:
        return self._get_annotation(
            tokens=self.matched_compounds,
            token_type=EntityType.COMPOUND.value,
            color=EntityColor.COMPOUND.value,
            id_str=entity_id_str,
            char_coord_objs_in_pdf=char_coord_objs_in_pdf,
            cropbox_in_pdf=cropbox_in_pdf,
        )

    def _annotate_proteins(
        self,
        entity_id_str: str,
        char_coord_objs_in_pdf: List[Union[LTChar, LTAnno]],
        cropbox_in_pdf: Tuple[int, int],
    ) -> List[Annotation]:
        return self._get_annotation(
            tokens=self.matched_proteins,
            token_type=EntityType.PROTEIN.value,
            color=EntityColor.PROTEIN.value,
            id_str=entity_id_str,
            char_coord_objs_in_pdf=char_coord_objs_in_pdf,
            cropbox_in_pdf=cropbox_in_pdf,
        )

    def _annotate_local_species_inclusions(
        self,
        char_coord_objs_in_pdf: List[Union[LTChar, LTAnno]],
        cropbox_in_pdf: Tuple[int, int],
    ) -> List[Annotation]:
        """Similar to self._get_annotation() but for creating
        annotations of custom species.

        However, does not check if a synonym is used by multiple
        common names that all appear in the document, as assume
        user wants these custom species annotations to be
        annotated.
        """
        tokens = self.matched_local_species_inclusion

        custom_annotations: List[Annotation] = []

        for word, token_list in tokens.items():
            entities = self.local_species_inclusion.get(normalize_str(word), None) or []
            for token_positions in token_list:
                for entity in entities:
                    annotation = self._create_annotation_object(
                        char_coord_objs_in_pdf=char_coord_objs_in_pdf,
                        cropbox_in_pdf=cropbox_in_pdf,
                        token_positions=token_positions,
                        token_type=EntityType.SPECIES.value,
                        entity=entity,
                        entity_id=entity[EntityIdStr.SPECIES.value],
                        entity_category=entity.get('category', ''),
                        color=EntityColor.SPECIES.value,
                    )

                    custom_annotations.append(annotation)
        return custom_annotations

    def _annotate_species(
        self,
        entity_id_str: str,
        char_coord_objs_in_pdf: List[Union[LTChar, LTAnno]],
        cropbox_in_pdf: Tuple[int, int],
        organisms_from_custom_annotations: List[dict],
    ) -> List[Annotation]:
        species_annotations = self._get_annotation(
            tokens=self.matched_species,
            token_type=EntityType.SPECIES.value,
            color=EntityColor.SPECIES.value,
            id_str=entity_id_str,
            char_coord_objs_in_pdf=char_coord_objs_in_pdf,
            cropbox_in_pdf=cropbox_in_pdf,
        )

        species_inclusions = self._annotate_local_species_inclusions(
            char_coord_objs_in_pdf=char_coord_objs_in_pdf,
            cropbox_in_pdf=cropbox_in_pdf,
        )

        def has_center_point(
            custom_rect_coords: List[float],
            rect_coords: List[float],
        ) -> bool:
            x1 = rect_coords[0]
            y1 = rect_coords[1]
            x2 = rect_coords[2]
            y2 = rect_coords[3]

            center_x = (x1 + x2)/2
            center_y = (y1 + y2)/2

            rect_x1 = custom_rect_coords[0]
            rect_y1 = custom_rect_coords[1]
            rect_x2 = custom_rect_coords[2]
            rect_y2 = custom_rect_coords[3]

            return rect_x1 <= center_x <= rect_x2 and rect_y1 <= center_y <= rect_y2

        # we only want the annotations with correct coordinates
        # because it is possible for a word to only have one
        # of its occurrences annotated as a custom annotation
        filtered_custom_species_annotations: List[Annotation] = []
        for custom in organisms_from_custom_annotations:
            for custom_anno in species_inclusions:
                if custom.get('rects', None):
                    if len(custom['rects']) == len(custom_anno.rects):
                        # check if center point for each rect in custom_anno.rects
                        # is in the corresponding rectangle from custom annotations
                        valid = all(list(map(has_center_point, custom['rects'], custom_anno.rects)))

                        # if center point is in custom annotation rectangle
                        # then add it to list
                        if valid:
                            filtered_custom_species_annotations.append(custom_anno)
                else:
                    raise AnnotationError(
                        'Manual annotations unexpectedly missing attribute "rects".')

        self.organism_frequency, self.organism_locations, self.organism_categories = \
            self._get_entity_frequency_location_and_category(
                annotations=species_annotations + filtered_custom_species_annotations,
            )

        # don't return the custom annotations because they should stay as custom
        return species_annotations

    def _annotate_diseases(
        self,
        entity_id_str: str,
        char_coord_objs_in_pdf: List[Union[LTChar, LTAnno]],
        cropbox_in_pdf: Tuple[int, int],
    ) -> List[Annotation]:
        return self._get_annotation(
            tokens=self.matched_diseases,
            token_type=EntityType.DISEASE.value,
            color=EntityColor.DISEASE.value,
            id_str=entity_id_str,
            char_coord_objs_in_pdf=char_coord_objs_in_pdf,
            cropbox_in_pdf=cropbox_in_pdf,
        )

    def _annotate_phenotypes(
        self,
        entity_id_str: str,
        char_coord_objs_in_pdf: List[Union[LTChar, LTAnno]],
        cropbox_in_pdf: Tuple[int, int],
    ) -> List[Annotation]:
        return self._get_annotation(
            tokens=self.matched_phenotypes,
            token_type=EntityType.PHENOTYPE.value,
            color=EntityColor.PHENOTYPE.value,
            id_str=entity_id_str,
            char_coord_objs_in_pdf=char_coord_objs_in_pdf,
            cropbox_in_pdf=cropbox_in_pdf,
        )

    def annotate(
        self,
        annotation_type: str,
        entity_id_str: str,
        char_coord_objs_in_pdf: List[Union[LTChar, LTAnno]],
        cropbox_in_pdf: Tuple[int, int],
        organisms_from_custom_annotations: List[dict],
    ) -> List[Annotation]:
        funcs = {
            EntityType.CHEMICAL.value: self._annotate_chemicals,
            EntityType.COMPOUND.value: self._annotate_compounds,
            EntityType.PROTEIN.value: self._annotate_proteins,
            EntityType.SPECIES.value: self._annotate_species,
            EntityType.DISEASE.value: self._annotate_diseases,
            EntityType.PHENOTYPE.value: self._annotate_phenotypes,
            EntityType.GENE.value: self._annotate_genes,
        }

        annotate_entities = funcs[annotation_type]
        if annotation_type == EntityType.SPECIES.value:
            return annotate_entities(
                entity_id_str=entity_id_str,
                char_coord_objs_in_pdf=char_coord_objs_in_pdf,
                cropbox_in_pdf=cropbox_in_pdf,
                organisms_from_custom_annotations=organisms_from_custom_annotations,
            )  # type: ignore
        else:
            return annotate_entities(
                entity_id_str=entity_id_str,
                char_coord_objs_in_pdf=char_coord_objs_in_pdf,
                cropbox_in_pdf=cropbox_in_pdf,
            )  # type: ignore

    def _update_entity_frequency_map(
        self,
        entity_frequency: Dict[str, int],
        annotation: Annotation,
    ) -> Dict[str, int]:
        entity_id = annotation.meta.id
        if entity_frequency.get(entity_id, None) is not None:
            entity_frequency[entity_id] += 1
        else:
            entity_frequency[entity_id] = 1

        # If this annotation is a virus then we also have to update the homo sapiens frequency
        if isinstance(annotation.meta, OrganismAnnotation.OrganismMeta) and annotation.meta.category == OrganismCategory.VIRUSES.value:  # noqa
            if entity_frequency.get(HOMO_SAPIENS_TAX_ID, None) is not None:
                entity_frequency[HOMO_SAPIENS_TAX_ID] += 1
            else:
                entity_frequency[HOMO_SAPIENS_TAX_ID] = 1

        return entity_frequency

    def _update_entity_location_map(
        self,
        matched_entity_locations: Dict[str, List[Tuple[int, int]]],
        annotation: Annotation,
    ) -> Dict[str, List[Tuple[int, int]]]:
        if matched_entity_locations.get(annotation.meta.id, None) is not None:
            matched_entity_locations[annotation.meta.id].append(
                (annotation.lo_location_offset, annotation.hi_location_offset)
            )
        else:
            matched_entity_locations[annotation.meta.id] = [
                (annotation.lo_location_offset, annotation.hi_location_offset)
            ]

        # If the annotation represents a virus, then also mark this location as a human
        # annotation
        if isinstance(annotation.meta, OrganismAnnotation.OrganismMeta) and annotation.meta.category == OrganismCategory.VIRUSES.value:  # noqa
            if matched_entity_locations.get(HOMO_SAPIENS_TAX_ID, None) is not None:  # noqa
                matched_entity_locations[HOMO_SAPIENS_TAX_ID].append(  # noqa
                    (annotation.lo_location_offset, annotation.hi_location_offset)
                )
            else:
                matched_entity_locations[HOMO_SAPIENS_TAX_ID] = [
                    (annotation.lo_location_offset, annotation.hi_location_offset)
                ]

        return matched_entity_locations

    def _get_entity_frequency_location_and_category(
        self,
        annotations: List[Annotation],
    ) -> Tuple[
            Dict[str, int],
            Dict[str, List[Tuple[int, int]]],
            Dict[str, str]]:
        """Takes as input a list of annotation objects (intended to be of a single entity type).

        Returns the frequency of the annotation entities, and their locations within the document.
        """
        matched_entity_locations: Dict[str, List[Tuple[int, int]]] = {}
        entity_frequency: Dict[str, int] = {}
        entity_categories: Dict[str, str] = {}

        for annotation in annotations:
            entity_frequency = self._update_entity_frequency_map(
                entity_frequency=entity_frequency,
                annotation=annotation,
            )
            matched_entity_locations = self._update_entity_location_map(
                matched_entity_locations=matched_entity_locations,
                annotation=annotation,
            )
            entity_categories[annotation.meta.id] = annotation.meta.to_dict().get('category', '')

            # Need to add an entry for humans if we annotated a virus
            if isinstance(annotation, OrganismAnnotation) and isinstance(annotation.meta, OrganismAnnotation.OrganismMeta):  # noqa
                if annotation.meta.category == OrganismCategory.VIRUSES.value:  # noqa
                    entity_categories[HOMO_SAPIENS_TAX_ID] = OrganismCategory.EUKARYOTA.value

        return entity_frequency, matched_entity_locations, entity_categories

    def _get_fixed_false_positive_unified_annotations(
        self,
        annotations_list: List[Annotation],
    ) -> List[Annotation]:
        """Removes any false positive annotations.

        False positives occurred during our matching
        because we normalize the text from the pdf and
        the keys in lmdb.

        False positives are multi length word that
        got matched to a shorter length word due to
        normalizing in lmdb.

        Gene related false positives are bacterial
        genes in the form of cysB, algA, deaD, etc.
        """
        fixed_annotations: List[Annotation] = []

        for annotation in annotations_list:
            text_in_document = annotation.text_in_document.split(' ')

            # TODO: Does the order of these checks matter?

            if len(text_in_document) > 1:
                keyword_from_annotation = annotation.keyword.split(' ')
                if len(keyword_from_annotation) >= len(text_in_document):
                    fixed_annotations.append(annotation)
                else:
                    # consider case such as `ferredoxin 2` vs `ferredoxin-2` in lmdb
                    keyword_from_annotation = annotation.keyword.split('-')
                    if len(keyword_from_annotation) >= len(text_in_document):
                        fixed_annotations.append(annotation)
            elif isinstance(annotation, GeneAnnotation):
                text_in_document = text_in_document[0]  # type: ignore
                if text_in_document == annotation.keyword:
                    fixed_annotations.append(annotation)
            elif annotation.meta.type == EntityType.PROTEIN.value:
                text_in_document = text_in_document[0]  # type: ignore
                if text_in_document == annotation.keyword:
                    fixed_annotations.append(annotation)
            else:
                fixed_annotations.append(annotation)

        return fixed_annotations

    def _process_inclusions_and_lmdb(
        self,
        tokens: List[PDFTokenPositions],
        check_entities_in_lmdb: Dict[str, bool],
        global_inclusions: List[Tuple[str, str, Any, Any]],
    ):
        deque(starmap(self._set_global_inclusions, global_inclusions), maxlen=0)

        # find matches in lmdb
        deque(map(partial(self._find_lmdb_match, check_entities=check_entities_in_lmdb), tokens), maxlen=0)  # noqa

    def _create_annotations(
        self,
        char_coord_objs_in_pdf: List[Union[LTChar, LTAnno]],
        cropbox_in_pdf: Tuple[int, int],
        types_to_annotate: List[Tuple[str, str]],
        organisms_from_custom_annotations: List[dict],
    ) -> List[Annotation]:
        """Create annotations.

        Args:
            tokens: list of PDFTokenPositions
            char_coord_objs_in_pdf: list of char objects from pdfminer
            cropbox_in_pdf: the mediabox/cropbox offset from pdfminer
            check_entities_in_lmdb: a dictionary of entity types and boolean
                - boolean determines whether to check lmdb for that entity
            types_to_annotate: list of entity types to create annotations of
                - NOTE: IMPORTANT: should always match with `check_entities_in_lmdb`
                - NOTE: IMPORTANT: Species should always be before Genes
                    - because species is used to do gene organism matching
                - e.g [
                    (EntityType.SPECIES.value, EntityIdStr.SPECIES.value),
                    (EntityType.CHEMICAL.value, EntityIdStr.CHEMICAL.value),
                    ...
                ]
        """
        unified_annotations: List[Annotation] = []

        for entity_type, entity_id_str in types_to_annotate:
            annotations = self.annotate(
                annotation_type=entity_type,
                entity_id_str=entity_id_str,
                char_coord_objs_in_pdf=char_coord_objs_in_pdf,
                cropbox_in_pdf=cropbox_in_pdf,
                organisms_from_custom_annotations=organisms_from_custom_annotations,
            )
            unified_annotations.extend(annotations)

        return unified_annotations

    def create_rules_based_annotations(
        self,
        tokens: PDFTokenPositionsList,
        custom_annotations: List[dict],
    ) -> List[Annotation]:
        entity_type_and_id_pairs = [
            # TODO: move this to a getter function since it's used multiple times
            # Order is IMPORTANT here, Species should always be annotated before Genes
            (EntityType.CHEMICAL.value, EntityIdStr.CHEMICAL.value),
            (EntityType.COMPOUND.value, EntityIdStr.COMPOUND.value),
            (EntityType.PROTEIN.value, EntityIdStr.PROTEIN.value),
            (EntityType.DISEASE.value, EntityIdStr.DISEASE.value),
            (EntityType.PHENOTYPE.value, EntityIdStr.PHENOTYPE.value),
            (EntityType.SPECIES.value, EntityIdStr.SPECIES.value),
            (EntityType.GENE.value, EntityIdStr.GENE.value),
        ]

        # TODO: hard coding for now until UI is done
        entities_to_check = {
            EntityType.CHEMICAL.value: True,
            EntityType.COMPOUND.value: True,
            EntityType.DISEASE.value: True,
            EntityType.GENE.value: True,
            EntityType.PHENOTYPE.value: True,
            EntityType.PROTEIN.value: True,
            EntityType.SPECIES.value: True,
        }

        self._set_local_species_inclusion(custom_annotations)
        self._process_inclusions_and_lmdb(
            tokens=tokens.token_positions,
            check_entities_in_lmdb=entities_to_check,
            global_inclusions=self._get_global_inclusion_pairs()
        )

        annotations = self._create_annotations(
            char_coord_objs_in_pdf=tokens.char_coord_objs_in_pdf,
            cropbox_in_pdf=tokens.cropbox_in_pdf,
            types_to_annotate=entity_type_and_id_pairs,
            organisms_from_custom_annotations=custom_annotations,
        )
        return self._clean_annotations(annotations=annotations)

    def create_nlp_annotations(
        self,
        page_index: Dict[int, int],
        text: str,
        tokens: PDFTokenPositionsList,
        custom_annotations: List[dict]
    ) -> List[Annotation]:
        cumm_nlp_resp = []
        nlp_tokens: List[PDFTokenPositions] = []
        req = None
        pages_to_index = {v: k for k, v in page_index.items()}
        pages = list(pages_to_index)
        text_in_page: List[Tuple[int, str]] = []

        # TODO: Breaking the request into pages
        # because doing the entire PDF seem to cause
        # the NLP service container to crash with no
        # errors and exit code of 247... (memory related)
        length = len(pages) - 1
        for i, page in enumerate(pages):
            if i == length:
                text_in_page.append((page, text[pages_to_index[page]:]))
            else:
                text_in_page.append((page, text[pages_to_index[page]:pages_to_index[page+1]]))

        for page, page_text in text_in_page:
            try:
                req = requests.post(NLP_ENDPOINT, json={'text': page_text}, timeout=30)
                nlp_resp = req.json()

                for predicted in nlp_resp:
                    # TODO: nlp only checks for Bacteria right now
                    # replace with Species in the future
                    if predicted['type'] != 'Bacteria':
                        # need to do offset here because index resets
                        # after each text string for page
                        offset = pages_to_index[page]
                        curr_char_idx_mappings = {
                            i+offset: char for i, char in zip(
                                range(predicted['low_index'], predicted['high_index']),
                                predicted['item'],
                            )
                        }

                        # determine page keyword is on
                        page_idx = -1
                        min_page_idx_list = list(tokens.min_idx_in_page)
                        for min_page_idx in min_page_idx_list:
                            # include offset here, see above
                            if predicted['high_index']+offset <= min_page_idx:
                                # reminder: can break here because dict in python 3.8+ are
                                # insertion order
                                break
                            else:
                                page_idx = min_page_idx
                        token = PDFTokenPositions(
                            page_number=tokens.min_idx_in_page[page_idx],
                            keyword=predicted['item'],
                            char_positions=curr_char_idx_mappings,
                            token_type=predicted['type'],
                        )
                        nlp_tokens.append(token)

                        offset_predicted = {k: v for k, v in predicted.items()}
                        offset_predicted['high_index'] += offset
                        offset_predicted['low_index'] += offset

                        cumm_nlp_resp.append(offset_predicted)
            except requests.exceptions.ConnectTimeout:
                raise AnnotationError(
                    'The request timed out while trying to connect to the NLP service.')
            except requests.exceptions.Timeout:
                raise AnnotationError(
                    'The request to the NLP service timed out.')
            except requests.exceptions.RequestException:
                raise AnnotationError(
                    'An unexpected error occurred with the NLP service.')

        current_app.logger.info(
            f'NLP Response Output: {json.dumps(cumm_nlp_resp)}',
            extra=EventLog(event_type='annotations').to_dict()
        )

        if req:
            req.close()

        # match species using rules based approach
        # TODO: possibly until nlp gets better at identifying species
        entity_type_and_id_pairs = [
            (EntityType.SPECIES.value, EntityIdStr.SPECIES.value),
        ]

        # TODO: hard coding for now until UI is done
        entities_to_check = {EntityType.SPECIES.value: True}

        self._set_local_species_inclusion(custom_annotations)
        self._process_inclusions_and_lmdb(
            tokens=tokens.token_positions,
            check_entities_in_lmdb=entities_to_check,
            global_inclusions=self._get_global_inclusion_pairs()
        )

        species_annotations = self._create_annotations(
            char_coord_objs_in_pdf=tokens.char_coord_objs_in_pdf,
            cropbox_in_pdf=tokens.cropbox_in_pdf,
            types_to_annotate=entity_type_and_id_pairs,
            organisms_from_custom_annotations=custom_annotations,
        )

        # now annotate what nlp found
        entity_type_and_id_pairs = [
            (EntityType.CHEMICAL.value, EntityIdStr.CHEMICAL.value),
            (EntityType.COMPOUND.value, EntityIdStr.COMPOUND.value),
            (EntityType.PROTEIN.value, EntityIdStr.PROTEIN.value),
            (EntityType.DISEASE.value, EntityIdStr.DISEASE.value),
            (EntityType.PHENOTYPE.value, EntityIdStr.PHENOTYPE.value),
            (EntityType.GENE.value, EntityIdStr.GENE.value),
        ]

        # TODO: hard coding for now until UI is done
        entities_to_check = {
            EntityType.CHEMICAL.value: True,
            EntityType.COMPOUND.value: True,
            EntityType.DISEASE.value: True,
            EntityType.GENE.value: True,
            EntityType.PHENOTYPE.value: True,
            EntityType.PROTEIN.value: True,
        }

        self._process_inclusions_and_lmdb(
            tokens=nlp_tokens,
            check_entities_in_lmdb=entities_to_check,
            global_inclusions=self._get_global_inclusion_pairs()
        )

        nlp_annotations = self._create_annotations(
            char_coord_objs_in_pdf=tokens.char_coord_objs_in_pdf,
            cropbox_in_pdf=tokens.cropbox_in_pdf,
            types_to_annotate=entity_type_and_id_pairs,
            organisms_from_custom_annotations=custom_annotations,
        )

        unified_annotations = species_annotations + nlp_annotations

        # TODO: TEMP to keep track of things not matched in LMDB
        matched: Set[str] = set()
        predicted_set: Set[str] = set()
        for predicted in cumm_nlp_resp:
            predicted_str = predicted['item']
            predicted_type = predicted['type']
            predicted_hashstr = f'{predicted_str},{predicted_type}'
            predicted_set.add(predicted_hashstr)

        for anno in unified_annotations:
            # TODO: temp for now as NLP only use Bacteria
            if anno.meta.type == 'Species':
                keyword_type = 'Bacteria'
            else:
                keyword_type = anno.meta.type
            hashstr = f'{anno.text_in_document},{keyword_type}'
            matched.add(hashstr)

        not_matched = predicted_set - matched

        current_app.logger.info(
            f'NLP TOKENS NOT MATCHED TO LMDB {not_matched}',
            extra=EventLog(event_type='annotations').to_dict()
        )
        return self._clean_annotations(annotations=unified_annotations)

    def _clean_annotations(
        self,
        annotations: List[Annotation],
    ) -> List[Annotation]:
        fixed_unified_annotations = self._get_fixed_false_positive_unified_annotations(
            annotations_list=annotations,
        )

        fixed_unified_annotations = self.fix_conflicting_annotations(
            unified_annotations=fixed_unified_annotations,
        )
        return fixed_unified_annotations

    def fix_conflicting_annotations(
        self,
        unified_annotations: List[Annotation],
    ) -> List[Annotation]:
        """Annotations and keywords may span multiple entity types
        (e.g. compounds, chemicals, organisms, etc.), resulting in conflicting
        annotations.

        An annotation is a conflict if:
        - it has overlapping `lo_location_offset` and `hi_location_offset` with
            another annotation.
        - it has adjacent intervals, meaning a `hi_location_offset` equals
            the `lo_location_offset` of another annotation.
        """
        updated_unified_annotations: List[Annotation] = []
        annotations_to_clean: List[Annotation] = []

        for unified in unified_annotations:
            if unified.lo_location_offset == unified.hi_location_offset:
                # keyword is a single character
                # should not have overlaps
                updated_unified_annotations.append(unified)
            else:
                annotations_to_clean.append(unified)

        tree = self.create_annotation_tree(annotations=annotations_to_clean)
        # first clean all annotations with equal intervals
        # this means the same keyword was mapped to multiple entities
        cleaned_of_equal_intervals = tree.merge_equals(
            data_reducer=self.determine_entity_precedence,
        )

        fixed_annotations = self._remove_overlapping_annotations(
            conflicting_annotations=cleaned_of_equal_intervals,
        )

        updated_unified_annotations.extend(fixed_annotations)
        return updated_unified_annotations

    def create_annotation_tree(
        self,
        annotations: List[Annotation],
    ) -> AnnotationIntervalTree:
        tree = AnnotationIntervalTree()
        for annotation in annotations:
            tree.add(
                AnnotationInterval(
                    begin=annotation.lo_location_offset,
                    end=annotation.hi_location_offset,
                    data=annotation,
                ),
            )
        return tree

    def determine_entity_precedence(
        self,
        anno1: Annotation,
        anno2: Annotation,
    ) -> Annotation:
        key1 = ENTITY_TYPE_PRECEDENCE[anno1.meta.type]
        key2 = ENTITY_TYPE_PRECEDENCE[anno2.meta.type]

        # if custom phenotype and MESH phenotype
        # then choose MESH
        if ((anno1.meta.type == EntityType.PHENOTYPE.value and
                anno2.meta.type == EntityType.PHENOTYPE.value) and
            (anno1.lo_location_offset == anno2.lo_location_offset and
                anno1.hi_location_offset == anno2.hi_location_offset)):  # noqa
            if anno1.meta.id_type == DatabaseType.MESH.value:
                return anno1
            elif anno2.meta.id_type == DatabaseType.MESH.value:
                return anno2

        # only do special gene vs protein comparison if they have
        # exact intervals
        # because that means the same normalized text was matched
        # to both
        if ((anno1.meta.type == EntityType.PROTEIN.value or
                anno1.meta.type == EntityType.GENE.value) and
            (anno2.meta.type == EntityType.PROTEIN.value or
                anno2.meta.type == EntityType.GENE.value) and
            (anno1.lo_location_offset == anno2.lo_location_offset and
                anno1.hi_location_offset == anno2.hi_location_offset)):  # noqa
            if anno1.meta.type != anno2.meta.type:
                # protein vs gene
                # protein has capital first letter: CysB
                # gene has lowercase: cysB
                # also cases like gene SerpinA1 vs protein Serpin A1

                def check_gene_protein(
                    anno1: Annotation,
                    anno2: Annotation,
                    anno1_text_in_document: str,
                    anno2_text_in_document: str,
                ):
                    """First check for exact match
                    if no exact match then check substrings
                    e.g `Serpin A1` matched to `serpin A1`
                    e.g `SerpinA1` matched to `serpin A1`

                    We take the first case will not count hyphens separated
                    because hard to infer if it was used as a space
                    need to consider precedence in case gene and protein
                    have the exact spelling correct annotated word
                    """
                    if anno1_text_in_document == anno1.keyword:
                        return anno1
                    if anno2_text_in_document == anno2.keyword:
                        return anno2

                    if len(anno1_text_in_document.split(' ')) == len(anno1.keyword.split(' ')):
                        return anno1
                    if len(anno2_text_in_document.split(' ')) == len(anno2.keyword.split(' ')):
                        return anno2

                    return None

                if key1 > key2:
                    gene_protein_precedence_result = check_gene_protein(
                        anno1=anno1,
                        anno2=anno2,
                        anno1_text_in_document=anno1.text_in_document,
                        anno2_text_in_document=anno2.text_in_document,
                    )
                else:
                    gene_protein_precedence_result = check_gene_protein(
                        anno1=anno2,
                        anno2=anno1,
                        anno1_text_in_document=anno2.text_in_document,
                        anno2_text_in_document=anno1.text_in_document,
                    )

                if gene_protein_precedence_result is not None:
                    return gene_protein_precedence_result

        if key1 > key2:
            return anno1
        elif key2 > key1:
            return anno2
        else:
            if anno1.keyword_length > anno2.keyword_length:
                return anno1
            else:
                return anno2

    def _remove_overlapping_annotations(
        self,
        conflicting_annotations: List[Annotation],
    ) -> List[Annotation]:
        """Remove annotations based on rules defined in
        self.determine_entity_precedence().
        """
        fixed_annotations: List[Annotation] = []

        if conflicting_annotations:
            tree = self.create_annotation_tree(annotations=conflicting_annotations)
            fixed_annotations.extend(
                tree.merge_overlaps(
                    data_reducer=self.determine_entity_precedence,
                ),
            )
        return fixed_annotations

    def get_matching_manual_annotations(
        self,
        keyword: str,
        keyword_type: str,
        tokens: PDFTokenPositionsList
    ):
        """Returns coordinate positions and page numbers
        for all matching terms in the document
        """
        matches = []
        for token in tokens.token_positions:
            if keyword_type == EntityType.GENE.value:
                if token.keyword != keyword:
                    continue
            elif standardize_str(token.keyword) != standardize_str(keyword):
                continue
            keyword_positions: List[Annotation.TextPosition] = []
            self._create_keyword_objects(
                curr_page_coor_obj=tokens.char_coord_objs_in_pdf,
                indexes=list(token.char_positions.keys()),
                keyword_positions=keyword_positions,
                cropbox=tokens.cropbox_in_pdf,
            )
            rects = [pos.positions for pos in keyword_positions]
            keywords = [pos.value for pos in keyword_positions]
            matches.append({
                'pageNumber': token.page_number,
                'rects': rects,
                'keywords': keywords
            })
        return matches
