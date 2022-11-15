from typing import Dict, List

from sqlalchemy import and_

from neo4japp.database import DBConnection
from neo4japp.models import GlobalList

from .constants import EntityType, ManualAnnotationType
from .data_transfer_objects import GlobalExclusions


class AnnotationDBService(DBConnection):
    def get_global_exclusions(self):
        return self.session.query(
            GlobalList.annotation).filter(
                and_(GlobalList.type == ManualAnnotationType.EXCLUSION.value))

    def get_entity_exclusions(self, exclusions: List[dict]) -> GlobalExclusions:
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

        global_exclusions = [d.annotation for d in self.get_global_exclusions()]
        local_exclusions = [exc for exc in exclusions if not exc.get(
            'meta', {}).get('excludeGlobally', False)]  # safe to default to False?

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
