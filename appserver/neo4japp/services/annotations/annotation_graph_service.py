from typing import Dict, List

from flask import current_app
from neo4j import Record as Neo4jRecord, Transaction as Neo4jTx
from neo4japp.constants import LogEventType
from neo4japp.util import normalize_str
from neo4japp.utils.logger import EventLog

from .mixins.graph_mixin import GraphMixin

from .constants import EntityType
from .data_transfer_objects import GlobalInclusions, Inclusion
from .lmdb_util import *


class AnnotationGraphService(GraphMixin):
    def get_chemicals_from_chemical_ids(self, chemical_ids: List[str]) -> Dict[str, str]:
        result = self.exec_read_query_with_params(
            self.get_chemicals_by_ids, {'ids': chemical_ids})
        return {row['chemical_id']: row['chemical_name'] for row in result}

    def get_compounds_from_compound_ids(self, compound_ids: List[str]) -> Dict[str, str]:
        result = self.exec_read_query_with_params(
            self.get_compounds_by_ids, {'ids': compound_ids})
        return {row['compound_id']: row['compound_name'] for row in result}

    def get_diseases_from_disease_ids(self, disease_ids: List[str]) -> Dict[str, str]:
        result = self.exec_read_query_with_params(
            self.get_diseases_by_ids, {'ids': disease_ids})
        return {row['disease_id']: row['disease_name'] for row in result}

    def get_genes_from_gene_ids(self, gene_ids: List[str]) -> Dict[str, str]:
        result = self.exec_read_query_with_params(
            self.get_genes_by_ids, {'ids': gene_ids})
        return {row['gene_id']: row['gene_name'] for row in result}

    def get_proteins_from_protein_ids(self, protein_ids: List[str]) -> Dict[str, str]:
        result = self.exec_read_query_with_params(
            self.get_proteins_by_ids, {'ids': protein_ids})
        return {row['protein_id']: row['protein_name'] for row in result}

    def get_organisms_from_organism_ids(self, organism_ids: List[str]) -> Dict[str, str]:
        result = self.exec_read_query_with_params(
            self.get_species_by_ids, {'ids': organism_ids})
        return {row['organism_id']: row['organism_name'] for row in result}

    def get_mesh_from_mesh_ids(self, mesh_ids: List[str]) -> Dict[str, str]:
        result = self.exec_read_query_with_params(self.get_mesh_by_ids, {'ids': mesh_ids})
        return {row['mesh_id']: row['mesh_name'] for row in result}

    def _create_entity_inclusion(
        self,
        entity_type: str,
        inclusion_dict: dict,
        static_global_inclusions: dict
    ) -> None:
        createfuncs = {
            EntityType.ANATOMY.value: create_ner_type_anatomy,
            EntityType.CHEMICAL.value: create_ner_type_chemical,
            EntityType.COMPOUND.value: create_ner_type_compound,
            EntityType.DISEASE.value: create_ner_type_disease,
            EntityType.FOOD.value: create_ner_type_food,
            EntityType.GENE.value: create_ner_type_gene,
            EntityType.PHENOMENA.value: create_ner_type_phenomena,
            EntityType.PHENOTYPE.value: create_ner_type_phenotype,
            EntityType.PROTEIN.value: create_ner_type_protein,
            EntityType.SPECIES.value: create_ner_type_species,
            EntityType.COMPANY.value: create_ner_type_company,
            EntityType.ENTITY.value: create_ner_type_entity
        }

        global_inclusions = []
        params = {'entity_type': entity_type}

        if entity_type in {
            EntityType.ANATOMY.value,
            EntityType.DISEASE.value,
            EntityType.FOOD.value,
            EntityType.PHENOMENA.value
        }:
            global_inclusions = self.exec_read_query_with_params(
                self.get_mesh_global_inclusions_by_type, params)
        else:
            try:
                global_inclusions = static_global_inclusions[entity_type]
            except KeyError:
                # use ***ARANGO_DB_NAME***_global_inclusions
                pass

        # need to append here because an inclusion
        # might've not been matched to an existing entity
        # so look for it in Lifelike
        global_inclusions += self.exec_read_query_with_params(
            self.get_***ARANGO_DB_NAME***_global_inclusions_by_type, params)

        for inclusion in global_inclusions:
            normalized_synonym = normalize_str(inclusion['synonym'])
            if entity_type != EntityType.GENE.value and entity_type != EntityType.PROTEIN.value:
                entity = createfuncs[entity_type](
                    id_=inclusion['entity_id'],
                    name=inclusion['entity_name'],
                    synonym=inclusion['synonym']
                )
            else:
                entity = createfuncs[entity_type](
                    name=inclusion['entity_name'], synonym=inclusion['synonym'])

            if normalized_synonym in inclusion_dict:
                inclusion_dict[normalized_synonym].entities.append(entity)
            else:
                inclusion_dict[normalized_synonym] = Inclusion(
                    entities=[entity],
                    entity_id_type=inclusion['data_source'],
                    entity_id_hyperlink=inclusion.get('hyperlink', '')
                )

    def get_entity_inclusions(self, inclusions: List[dict]) -> GlobalInclusions:
        """Returns global inclusions for each entity type.
        For species (taxonomy), also return the local inclusions.

        :param inclusions:  custom annotations relative to file
            - need to be filtered for local inclusions
        """
        inclusion_dicts = {
            EntityType.ANATOMY.value: {},
            EntityType.CHEMICAL.value: {},
            EntityType.COMPOUND.value: {},
            EntityType.DISEASE.value: {},
            EntityType.FOOD.value: {},
            EntityType.GENE.value: {},
            EntityType.PHENOMENA.value: {},
            EntityType.PHENOTYPE.value: {},
            EntityType.PROTEIN.value: {},
            EntityType.SPECIES.value: {},
            EntityType.COMPANY.value: {},
            EntityType.ENTITY.value: {}
        }

        local_inclusion_dicts = {
            EntityType.SPECIES.value: {}
        }

        static_global_inclusions_by_type = {
            EntityType.GENE.value: self.exec_read_query(self.get_gene_global_inclusions),
            EntityType.SPECIES.value: self.exec_read_query(self.get_species_global_inclusions),
            EntityType.PROTEIN.value: self.exec_read_query(self.get_protein_global_inclusions)
        }

        for k, v in inclusion_dicts.items():
            self._create_entity_inclusion(k, v, static_global_inclusions_by_type)

        local_species_inclusions = [
            local for local in inclusions if local.get(
                'meta', {}).get('type') == EntityType.SPECIES.value and not local.get(
                    'meta', {}).get('includeGlobally', False)  # safe to default to False?
        ]

        for local_inclusion in local_species_inclusions:
            entity_type = EntityType.SPECIES.value
            try:
                entity_id = local_inclusion['meta']['id']
                entity_id_type = local_inclusion['meta']['idType']
                entity_id_hyperlink = local_inclusion['meta']['idHyperlink']
                synonym = local_inclusion['meta']['allText']
            except KeyError:
                current_app.logger.error(
                    f'Error creating local inclusion {local_inclusion} for {entity_type}',
                    extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
                )
            else:
                # entity_name could be empty strings
                # probably a result of testing
                # but will keep here just in case
                if entity_id and synonym:
                    normalized_synonym = normalize_str(synonym)

                    if not entity_id:
                        # ID is required for global inclusions
                        # but we also include local species inclusion
                        entity_id = synonym

                    entity = create_ner_type_species(
                        id_=entity_id,
                        name=synonym,
                        synonym=synonym
                    )

                    if normalized_synonym in local_inclusion_dicts[entity_type]:
                        local_inclusion_dicts[entity_type][normalized_synonym].entities.append(entity)  # noqa
                    else:
                        local_inclusion_dicts[entity_type][normalized_synonym] = Inclusion(
                            entities=[entity],
                            entity_id_type=entity_id_type,
                            entity_id_hyperlink=entity_id_hyperlink
                        )
        return GlobalInclusions(
            included_anatomy=inclusion_dicts[EntityType.ANATOMY.value],
            included_chemicals=inclusion_dicts[EntityType.CHEMICAL.value],
            included_compounds=inclusion_dicts[EntityType.COMPOUND.value],
            included_diseases=inclusion_dicts[EntityType.DISEASE.value],
            included_foods=inclusion_dicts[EntityType.FOOD.value],
            included_genes=inclusion_dicts[EntityType.GENE.value],
            included_phenomenas=inclusion_dicts[EntityType.PHENOMENA.value],
            included_phenotypes=inclusion_dicts[EntityType.PHENOTYPE.value],
            included_proteins=inclusion_dicts[EntityType.PROTEIN.value],
            included_species=inclusion_dicts[EntityType.SPECIES.value],
            included_local_species=local_inclusion_dicts[EntityType.SPECIES.value],
            included_companies=inclusion_dicts[EntityType.COMPANY.value],
            included_entities=inclusion_dicts[EntityType.ENTITY.value],
        )

    def get_gene_to_organism_match_result(
        self,
        genes: List[str],
        postgres_genes: Dict[str, Dict[str, Dict[str, str]]],
        matched_organism_ids: List[str],
    ) -> Dict[str, Dict[str, Dict[str, str]]]:
        """Returns a map of gene name to gene id."""
        postgres_result = postgres_genes

        # Collect all the genes that were not matched to an organism in the table, and search
        # the Neo4j database for them
        second_round_genes = [gene for gene in genes if gene not in postgres_result.keys()]
        neo4j_result = self.get_genes_to_organisms(second_round_genes, matched_organism_ids)

        # Join the results of the two queries
        postgres_result.update(neo4j_result)

        return postgres_result

    def get_genes_to_organisms(
        self,
        genes: List[str],
        organisms: List[str],
    ) -> Dict[str, Dict[str, Dict[str, str]]]:
        gene_to_organism_map: Dict[str, Dict[str, Dict[str, str]]] = {}

        result = self.exec_read_query_with_params(
            self.get_gene_to_organism, {'genes': genes, 'organisms': organisms})

        for row in result:
            gene_name = row['gene_name']
            gene_synonym = row['gene_synonym']
            gene_id = row['gene_id']
            organism_id = row['organism_id']

            if gene_to_organism_map.get(gene_synonym, None) is not None:
                if gene_to_organism_map[gene_synonym].get(gene_name, None):
                    gene_to_organism_map[gene_synonym][gene_name][organism_id] = gene_id
                else:
                    gene_to_organism_map[gene_synonym][gene_name] = {organism_id: gene_id}
            else:
                gene_to_organism_map[gene_synonym] = {gene_name: {organism_id: gene_id}}

        return gene_to_organism_map

    def get_proteins_to_organisms(
        self,
        proteins: List[str],
        organisms: List[str],
    ) -> Dict[str, Dict[str, str]]:
        protein_to_organism_map: Dict[str, Dict[str, str]] = {}

        result = self.exec_read_query_with_params(
            self.get_protein_to_organism, {'proteins': proteins, 'organisms': organisms})

        for row in result:
            protein_name: str = row['protein']
            organism_id: str = row['organism_id']
            # For now just get the first protein in the list of matches,
            # no way for us to infer which to use
            gene_id: str = row['protein_ids'][0]

            if protein_to_organism_map.get(protein_name, None) is not None:
                protein_to_organism_map[protein_name][organism_id] = gene_id
            else:
                protein_to_organism_map[protein_name] = {organism_id: gene_id}

        return protein_to_organism_map

    def get_organisms_from_gene_ids(self, gene_ids: List[str]):
        return self.graph.run(
            self.get_organisms_from_gene_ids_query,
            gene_ids
        )

    def get_organisms_from_gene_ids_query(
        self,
        tx: Neo4jTx,
        gene_ids: List[str]
    ) -> List[Neo4jRecord]:
        """Retrieves a list of gene and corresponding organism data
        from a given list of genes."""
        return list(
            tx.run(
                """
                MATCH (g:Gene) WHERE g.id IN $gene_ids
                WITH g
                MATCH (g)-[:HAS_TAXONOMY]-(t:Taxonomy)
                RETURN g.id AS gene_id, g.name as gene_name, t.id as taxonomy_id,
                    t.name as species_name
                """,
                gene_ids=gene_ids
            )
        )
