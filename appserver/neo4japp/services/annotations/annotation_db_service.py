from typing import Dict, List

from sqlalchemy import and_

from neo4japp.database import DBConnection
from neo4japp.models import GlobalList, OrganismGeneMatch

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
        exclusion_sets: Dict[str, set] = {
            EntityType.ANATOMY.value: set(),
            EntityType.CHEMICAL.value: set(),
            EntityType.COMPOUND.value: set(),
            EntityType.DISEASE.value: set(),
            EntityType.FOOD.value: set(),
            EntityType.GENE.value: set(),
            EntityType.PHENOMENA.value: set(),
            EntityType.PHENOTYPE.value: set(),
            EntityType.PROTEIN.value: set(),
            EntityType.SPECIES.value: set(),
            EntityType.COMPANY.value: set(),
            EntityType.ENTITY.value: set()
        }

        exclusion_sets_case_insensitive: Dict[str, set] = {
            EntityType.GENE.value: set(),
            EntityType.PROTEIN.value: set()
        }

        global_exclusions = [d.annotation for d in self.get_global_exclusions()]
        local_exclusions = [exc for exc in exclusions if not exc.get(
            'meta', {}).get('excludeGlobally', False)]  # safe to default to False?

        for exclude in global_exclusions + local_exclusions:
            try:
                excluded_text = exclude['text']
                entity_type = exclude['type']
            except KeyError:
                continue

            if excluded_text and entity_type in exclusion_sets:
                if entity_type == EntityType.GENE.value or entity_type == EntityType.PROTEIN.value:  # noqa
                    if exclude.get('isCaseInsensitive', False):
                        if entity_type in exclusion_sets_case_insensitive:
                            exclusion_sets_case_insensitive[entity_type].add(excluded_text.lower())  # noqa
                    else:
                        exclusion_sets[entity_type].add(excluded_text)
                else:
                    exclusion_sets[entity_type].add(excluded_text.lower())

        return GlobalExclusions(
            excluded_anatomy=exclusion_sets[EntityType.ANATOMY.value],
            excluded_chemicals=exclusion_sets[EntityType.CHEMICAL.value],
            excluded_compounds=exclusion_sets[EntityType.COMPOUND.value],
            excluded_diseases=exclusion_sets[EntityType.DISEASE.value],
            excluded_foods=exclusion_sets[EntityType.FOOD.value],
            excluded_genes=exclusion_sets[EntityType.GENE.value],
            excluded_phenomenas=exclusion_sets[EntityType.PHENOMENA.value],
            excluded_phenotypes=exclusion_sets[EntityType.PHENOTYPE.value],
            excluded_proteins=exclusion_sets[EntityType.PROTEIN.value],
            excluded_species=exclusion_sets[EntityType.SPECIES.value],
            excluded_genes_case_insensitive=exclusion_sets_case_insensitive[EntityType.GENE.value],  # noqa
            excluded_proteins_case_insensitive=exclusion_sets_case_insensitive[EntityType.PROTEIN.value],  # noqa
            excluded_companies=exclusion_sets[EntityType.COMPANY.value],
            excluded_entities=exclusion_sets[EntityType.ENTITY.value]
        )

    def get_organism_genes(
        self,
        genes: List[str],
        organism_ids: List[str]
    ) -> Dict[str, Dict[str, Dict[str, str]]]:
        result = self.session.query(
            OrganismGeneMatch.gene_name,
            OrganismGeneMatch.synonym,
            OrganismGeneMatch.gene_id,
            OrganismGeneMatch.taxonomy_id,
        ).filter(
            and_(
                OrganismGeneMatch.synonym.in_(genes),
                OrganismGeneMatch.taxonomy_id.in_(organism_ids),
            )
        )

        gene_to_organism_map: Dict[str, Dict[str, Dict[str, str]]] = {}
        for row in result:
            gene_name: str = row[0]
            gene_synonym: str = row[1]
            gene_id: str = row[2]
            organism_id: str = row[3]

            if gene_to_organism_map.get(gene_synonym, None) is not None:
                if gene_to_organism_map[gene_synonym].get(gene_name, None):
                    gene_to_organism_map[gene_synonym][gene_name][organism_id] = gene_id
                else:
                    gene_to_organism_map[gene_synonym][gene_name] = {organism_id: gene_id}
            else:
                gene_to_organism_map[gene_synonym] = {gene_name: {organism_id: gene_id}}

        return gene_to_organism_map
