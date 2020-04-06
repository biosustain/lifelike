import json
import re

from string import ascii_lowercase, punctuation
from typing import Dict, List, Set, Tuple

from .constants import (
    COMMON_WORDS,
    TYPO_SYNONYMS,
    EntityColor,
    EntityIdStr,
    EntityType,
)
from .lmdb_dao import LMDBDao


class AnnotationsService:
    def __init__(
        self,
        lmdb_session: LMDBDao,
    ) -> None:
        self.regex_for_floats = r'^-?\d+(?:\.\d+)?$'

        self.lmdb_session = lmdb_session

        # for word tokens that are typos
        self.correct_synonyms = dict()

        self.matched_genes = set()
        self.matched_chemicals = set()
        self.matched_compounds = set()
        self.matched_proteins = set()
        self.matched_species = set()
        self.matched_diseases = set()

    def lmdb_validation(
        self,
        word: str,
        synonym: str,
    ):
        """Validate the lookup key exists in LMDB. If it
        does, then add it as a match.

        Args:
            word: the token text
            synonym: the correct spelling (if word is misspelled) or normalized token
        """
        lookup_key = synonym.lower().encode('utf-8')

        gene_val = self.lmdb_session.genes_txn.get(lookup_key)
        if gene_val:
            self.matched_genes.add(word)

        chem_val = self.lmdb_session.chemicals_txn.get(lookup_key)
        if chem_val:
            self.matched_chemicals.add(word)

        comp_val = self.lmdb_session.compounds_txn.get(lookup_key)
        if comp_val:
            self.matched_compounds.add(word)

        protein_val = self.lmdb_session.proteins_txn.get(lookup_key)
        if protein_val:
            self.matched_proteins.add(word)

        species_val = self.lmdb_session.species_txn.get(lookup_key)
        if species_val:
            self.matched_species.add(word)

        diseases_val = self.lmdb_session.diseases_txn.get(lookup_key)
        if diseases_val:
            self.matched_diseases.add(word)

        return [gene_val, chem_val, comp_val, protein_val, species_val, diseases_val]

    def _filter_tokens(self, tokens: Set[str]) -> None:
        """Filter the tokens into separate matched sets in LMDB."""
        for token in tokens:
            # TODO: the order of stripping here will need to be looked at
            # e.g 'sdfasdf()() ' vs 'sdfd  **&()'
            token_normalized = token.strip(punctuation)
            token_normalized = token_normalized.strip()

            if token_normalized:
                # this is to normalize multiple spacings into single space
                token_normalized_whitespace = token_normalized.lower()
                token_normalized_whitespace = ' '.join(token_normalized_whitespace.split())

                if (token_normalized_whitespace not in COMMON_WORDS and
                    not re.match(self.regex_for_floats, token_normalized_whitespace) and
                    token_normalized_whitespace not in ascii_lowercase):

                    if token_normalized_whitespace in TYPO_SYNONYMS:
                        for correct_synonym in TYPO_SYNONYMS[token_normalized_whitespace]:
                            validations = self.lmdb_validation(
                                word=token_normalized,
                                synonym=correct_synonym,
                            )

                            # just get the first match is fine
                            if any(validations):
                                self.correct_synonyms[token_normalized] = correct_synonym
                                break
                    else:
                        self.lmdb_validation(
                            word=token_normalized,
                            synonym=token_normalized_whitespace,
                        )

    def _get_annotation(
        self,
        tokens: Set[str],
        token_type: str,
        color: str,
        transaction,
        id_str: str,
        correct_synonyms: Dict[str, str],
    ) -> Tuple[List[dict], Set[str]]:
        """Create annotation objects for tokens.

        Assumption:
            - An entity in LMDB will always have a common name
                (1) this means a common name will have itself as a common name
                (2) synonyms will have at least one common name

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
        """
        matches = []
        unwanted_matches = set()

        tokens_lowercased = {t.lower() for t in tokens}

        for word in tokens:
            if word in correct_synonyms:
                lookup_key = correct_synonyms[word]
            else:
                lookup_key = word

            # normalize multiple spaces
            lookup_key = ' '.join(lookup_key.split())
            entity = json.loads(transaction.get(lookup_key.lower().encode('utf-8')))

            common_name_count = 0
            if len(entity['common_name']) > 1:
                common_names = set([v for _,v in entity['common_name'].items()])
                common_names_in_doc_text = [n in tokens_lowercased for n in common_names]

                # skip if none of the common names appear
                if not any(common_names_in_doc_text):
                    continue
                else:
                    for k, v in entity['common_name'].items():
                        if v in tokens_lowercased:
                            common_name_count += 1
                            entity_id = k
            else:
                common_name_count = 1
                entity_id = entity[id_str]

            if common_name_count == 1:
                matches.append({
                    'keyword': word,
                    'type': token_type,
                    'color': color,
                    'id': entity_id,
                    'id_type': entity['id_type'],
                })
            else:
                unwanted_matches.add(word)

        return matches, unwanted_matches

    def _annotate_genes(self, entity_id_str: str) -> Tuple[List[dict], Set[str]]:
        return self._get_annotation(
            tokens=self.matched_genes,
            token_type=EntityType.Genes.value,
            color=EntityColor.Genes.value,
            transaction=self.lmdb_session.genes_txn,
            id_str=entity_id_str,
            correct_synonyms=self.correct_synonyms,
        )

    def _annotate_chemicals(self, entity_id_str: str) -> Tuple[List[dict], Set[str]]:
        return self._get_annotation(
            tokens=self.matched_chemicals,
            token_type=EntityType.Chemicals.value,
            color=EntityColor.Chemicals.value,
            transaction=self.lmdb_session.chemicals_txn,
            id_str=entity_id_str,
            correct_synonyms=self.correct_synonyms,
        )

    def _annotate_compounds(self, entity_id_str: str) -> Tuple[List[dict], Set[str]]:
        return self._get_annotation(
            tokens=self.matched_compounds,
            token_type=EntityType.Compounds.value,
            color=EntityColor.Compounds.value,
            transaction=self.lmdb_session.compounds_txn,
            id_str=entity_id_str,
            correct_synonyms=self.correct_synonyms,
        )

    def _annotate_proteins(self, entity_id_str: str) -> Tuple[List[dict], Set[str]]:
        return self._get_annotation(
            tokens=self.matched_proteins,
            token_type=EntityType.Proteins.value,
            color=EntityColor.Proteins.value,
            transaction=self.lmdb_session.proteins_txn,
            id_str=entity_id_str,
            correct_synonyms=self.correct_synonyms,
        )

    def _annotate_species(self, entity_id_str: str) -> Tuple[List[dict], Set[str]]:
        return self._get_annotation(
            tokens=self.matched_species,
            token_type=EntityType.Species.value,
            color=EntityColor.Species.value,
            transaction=self.lmdb_session.species_txn,
            id_str=entity_id_str,
            correct_synonyms=self.correct_synonyms,
        )

    def _annotate_diseases(self, entity_id_str: str) -> Tuple[List[dict], Set[str]]:
        return self._get_annotation(
            tokens=self.matched_diseases,
            token_type=EntityType.Diseases.value,
            color=EntityColor.Diseases.value,
            transaction=self.lmdb_session.diseases_txn,
            id_str=entity_id_str,
            correct_synonyms=self.correct_synonyms,
        )

    def annotate(
        self,
        annotation_type: str,
        entity_id_str: str,
    ) -> Tuple[List[dict], Set[str]]:
        funcs = {
            EntityType.Genes.value: self._annotate_genes,
            EntityType.Chemicals.value: self._annotate_chemicals,
            EntityType.Compounds.value: self._annotate_compounds,
            EntityType.Proteins.value: self._annotate_proteins,
            EntityType.Species.value: self._annotate_species,
            EntityType.Diseases.value: self._annotate_diseases,
        }

        annotate_entities = funcs[annotation_type]
        return annotate_entities(entity_id_str=entity_id_str)

    def _remove_unwanted_keywords(
        self,
        matches,
        unwanted_keywords,
    ) -> List[dict]:
        """Remove any unwanted keywords from annotations.
        """
        new_matches = []
        for obj in matches:
            if obj['keyword'] not in unwanted_keywords:
                new_matches.append(obj)
        return new_matches

    def create_annotations(self, tokens: Set[str]) -> List[dict]:
        self._filter_tokens(tokens=tokens)

        matched_genes, unwanted_genes = self.annotate(
            annotation_type=EntityType.Genes.value,
            entity_id_str=EntityIdStr.Genes.value,
        )

        matched_chemicals, unwanted_chemicals = self.annotate(
            annotation_type=EntityType.Chemicals.value,
            entity_id_str=EntityIdStr.Chemicals.value,
        )

        matched_compounds, unwanted_compounds = self.annotate(
            annotation_type=EntityType.Compounds.value,
            entity_id_str=EntityIdStr.Compounds.value,
        )

        matched_proteins, unwanted_proteins = self.annotate(
            annotation_type=EntityType.Proteins.value,
            entity_id_str=EntityIdStr.Proteins.value,
        )

        matched_species, unwanted_species = self.annotate(
            annotation_type=EntityType.Species.value,
            entity_id_str=EntityIdStr.Species.value,
        )

        matched_diseases, unwanted_diseases = self.annotate(
            annotation_type=EntityType.Diseases.value,
            entity_id_str=EntityIdStr.Diseases.value,
        )

        # TODO: considerations:
        # do we want to remove unwanted keywords from a
        # combined set like this?
        # or remove them from their individual matched set?
        #
        # e.g 'somethingA' is in unwanted_genes but also in unwanted_chemicals
        # remove from unwanted_genes because multiple common names appear
        # but only one common name in unwanted_chemicals appeared
        # so keep that one?
        unwanted_matches_set_list = [
            unwanted_genes,
            unwanted_chemicals,
            unwanted_compounds,
            unwanted_proteins,
            unwanted_species,
            unwanted_diseases,
        ]

        unwanted_keywords_set = set.union(*unwanted_matches_set_list)

        updated_matched_genes = self._remove_unwanted_keywords(
            matches=matched_genes,
            unwanted_keywords=unwanted_keywords_set,
        )

        updated_matched_chemicals = self._remove_unwanted_keywords(
            matches=matched_chemicals,
            unwanted_keywords=unwanted_keywords_set,
        )

        updated_matched_compounds = self._remove_unwanted_keywords(
            matches=matched_compounds,
            unwanted_keywords=unwanted_keywords_set,
        )

        updated_matched_proteins = self._remove_unwanted_keywords(
            matches=matched_proteins,
            unwanted_keywords=unwanted_keywords_set,
        )

        updated_matched_species = self._remove_unwanted_keywords(
            matches=matched_species,
            unwanted_keywords=unwanted_keywords_set,
        )

        updated_matched_diseases = self._remove_unwanted_keywords(
            matches=matched_diseases,
            unwanted_keywords=unwanted_keywords_set,
        )

        unified_annotations = []
        unified_annotations.extend(updated_matched_genes)
        unified_annotations.extend(updated_matched_chemicals)
        unified_annotations.extend(updated_matched_compounds)
        unified_annotations.extend(updated_matched_proteins)
        unified_annotations.extend(updated_matched_species)
        unified_annotations.extend(updated_matched_diseases)

        return unified_annotations
