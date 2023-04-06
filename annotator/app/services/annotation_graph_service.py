from arango.client import ArangoClient
from collections import defaultdict
from typing import Any, Dict, List

from ..logs import get_annotator_extras_obj, setup_annotator_logging
from ..utils import normalize_str

from .arangodb import execute_arango_query, get_db

from .constants import EntityType
from .data_transfer_objects import GlobalInclusions, GeneOrProteinToOrganism
from .utils.lmdb import (
    create_ner_type_anatomy,
    create_ner_type_chemical,
    create_ner_type_compound,
    create_ner_type_disease,
    create_ner_type_food,
    create_ner_type_gene,
    create_ner_type_phenomena,
    create_ner_type_phenotype,
    create_ner_type_protein,
    create_ner_type_species,
    create_ner_type_company,
    create_ner_type_entity,
    create_ner_type_lab_sample,
    create_ner_type_lab_strain,
    EntityIdStr
)
from .utils.graph_queries import (
    collection_labels,
    get_gene_to_organism_query,
    get_global_inclusions_by_type_query,
    get_***ARANGO_DB_NAME***_global_inclusions_by_type_query,
    get_organisms_from_gene_ids_query,
    get_protein_to_organism_query,
)

logger = setup_annotator_logging()


def _create_entity_inclusion(
    arango_client: ArangoClient,
    entity_type: str,
    inclusion_dict: dict
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
        EntityType.ENTITY.value: create_ner_type_entity,
        EntityType.LAB_SAMPLE.value: create_ner_type_lab_sample,
        EntityType.LAB_STRAIN.value: create_ner_type_lab_strain
    }

    # TODO: can we just do get_global_inclusions_by_type_query once?
    # get all nodes that a Synonym points to and filter on labels in python?
    # or would that be too much data to retrieve all at once?
    try:
        global_inclusions = execute_arango_query(
            db=get_db(arango_client),
            query=get_global_inclusions_by_type_query(),
            collection=collection_labels[entity_type],
            entity_type=entity_type
        )
    except KeyError:
        raise ValueError(
            f'Could not query for document with entity type: {entity_type}. No '
            'collection exists for this type.'
        )
    # need to append here because an inclusion
    # might've not been matched to an existing entity
    # so look for it in Lifelike
    global_inclusions += execute_arango_query(
        db=get_db(arango_client),
        query=get_***ARANGO_DB_NAME***_global_inclusions_by_type_query(),
        entity_type=entity_type
    )

    for inclusion in global_inclusions:
        normalized_synonym = normalize_str(inclusion['synonym'])
        if entity_type != EntityType.GENE.value and entity_type != EntityType.PROTEIN.value:
            entity = createfuncs[entity_type](
                id=inclusion['entity_id'],
                name=inclusion['entity_name'],
                synonym=inclusion['synonym']
            )  # type: ignore
        else:
            entity = createfuncs[entity_type](
                name=inclusion['entity_name'], synonym=inclusion['synonym'])  # type: ignore

            # for proteins, we use the name as the id in the LMDB data, but we don't
            # want to do this if the user provided an id or left it blank
            # so set it back to what it was
            if entity_type == EntityType.PROTEIN.value:
                entity[EntityIdStr.PROTEIN.value] = inclusion['entity_id']

        # override the default data source
        # e.g gene default is NCBI, but globals can be BioCyc
        entity['id_type'] = inclusion['data_source']
        entity['id_hyperlinks'] = inclusion.get('hyperlinks')
        inclusion_dict[normalized_synonym].append(entity)


def get_entity_inclusions(arango_client, inclusions: List[dict]) -> GlobalInclusions:
    """Returns global inclusions for each entity type.
    For species (taxonomy), also return the local inclusions.

    :param inclusions:  custom annotations relative to file
        - need to be filtered for local inclusions
    """
    inclusion_dicts: Dict[str, dict] = {
        EntityType.ANATOMY.value: defaultdict(list),
        EntityType.CHEMICAL.value: defaultdict(list),
        EntityType.COMPOUND.value: defaultdict(list),
        EntityType.DISEASE.value: defaultdict(list),
        EntityType.FOOD.value: defaultdict(list),
        EntityType.GENE.value: defaultdict(list),
        EntityType.PHENOMENA.value: defaultdict(list),
        EntityType.PHENOTYPE.value: defaultdict(list),
        EntityType.PROTEIN.value: defaultdict(list),
        EntityType.SPECIES.value: defaultdict(list),
        EntityType.COMPANY.value: defaultdict(list),
        EntityType.ENTITY.value: defaultdict(list),
        EntityType.LAB_SAMPLE.value: defaultdict(list),
        EntityType.LAB_STRAIN.value: defaultdict(list)
    }

    local_inclusion_dicts: Dict[str, dict] = {
        EntityType.SPECIES.value: defaultdict(list)
    }

    for k, v in inclusion_dicts.items():
        _create_entity_inclusion(arango_client, k, v)

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
            entity_id_hyperlinks = local_inclusion['meta']['idHyperlinks']
            synonym = local_inclusion['meta']['allText']
        except KeyError:
            logger.error(
                f'Error creating local inclusion {local_inclusion} for {entity_type}',
                extra=get_annotator_extras_obj()
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
                    id=entity_id,
                    name=synonym,
                    synonym=synonym
                )

                # override the default data source
                # e.g gene default is NCBI, but globals can be BioCyc
                entity['id_type'] = entity_id_type
                entity['id_hyperlinks'] = entity_id_hyperlinks
                local_inclusion_dicts[entity_type][normalized_synonym].append(entity)

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
        included_lab_samples=inclusion_dicts[EntityType.LAB_SAMPLE.value],
        included_lab_strains=inclusion_dicts[EntityType.LAB_STRAIN.value]
    )


def get_organisms_from_gene_ids(arango_client: ArangoClient, gene_ids: Dict[Any, int]):
    return execute_arango_query(
        db=get_db(arango_client),
        query=get_organisms_from_gene_ids_query(),
        gene_ids=list(gene_ids.keys())
    )


def get_genes_to_organisms(
    arango_client: ArangoClient,
    genes: List[str],
    organisms: List[str],
) -> GeneOrProteinToOrganism:
    gene_to_organism_map: Dict[str, Dict[str, Dict[str, str]]] = {}
    data_sources: Dict[str, str] = {}
    primary_names: Dict[str, str] = {}

    result = execute_arango_query(
        db=get_db(arango_client),
        query=get_gene_to_organism_query(),
        genes=genes,
        organisms=organisms
    )

    for row in result:
        gene_name = row['gene_name']
        gene_synonym = row['gene_synonym']
        gene_id = row['gene_id']
        organism_id = row['organism_id']
        data_source = row['data_source']
        data_source_key = f'{gene_synonym}{organism_id}'

        primary_names[gene_id] = gene_name
        data_sources[data_source_key] = data_source

        if gene_to_organism_map.get(gene_synonym, None) is not None:
            if gene_to_organism_map[gene_synonym].get(gene_name, None):
                gene_to_organism_map[gene_synonym][gene_name][organism_id] = gene_id
            else:
                gene_to_organism_map[gene_synonym][gene_name] = {organism_id: gene_id}
        else:
            gene_to_organism_map[gene_synonym] = {gene_name: {organism_id: gene_id}}

    # clean any gene/organism matches that have excess results
    # we want to prioritize matches where the primary name and synonym are the same
    for synonym, v in gene_to_organism_map.items():
        if synonym in v and len(v) > 1:
            gene_to_organism_map[synonym] = {synonym: v[synonym]}

    return GeneOrProteinToOrganism(
        matches=gene_to_organism_map,
        data_sources=data_sources,
        primary_names=primary_names
    )


def get_proteins_to_organisms(
    arango_client: ArangoClient,
    proteins: List[str],
    organisms: List[str],
) -> GeneOrProteinToOrganism:
    protein_to_organism_map: Dict[str, Dict[str, str]] = {}
    primary_names: Dict[str, str] = {}

    result = execute_arango_query(
        db=get_db(arango_client),
        query=get_protein_to_organism_query(),
        proteins=proteins,
        organisms=organisms
    )

    for row in result:
        protein_name: str = row['protein']
        organism_id: str = row['organism_id']
        # For now just get the first protein in the list of matches,
        # no way for us to infer which to use
        protein_id: str = row['protein_ids'][0]

        primary_names[protein_id] = protein_name

        if protein_to_organism_map.get(protein_name, None) is not None:
            protein_to_organism_map[protein_name][organism_id] = protein_id
        else:
            protein_to_organism_map[protein_name] = {organism_id: protein_id}

    return GeneOrProteinToOrganism(matches=protein_to_organism_map, primary_names=primary_names)
