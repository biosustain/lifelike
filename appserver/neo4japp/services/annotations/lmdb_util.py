from .constants import DatabaseType, EntityIdStr


def create_ner_type_anatomy(
    id_: str,
    name: str,
    synonym: str
) -> dict:
    return {
        EntityIdStr.ANATOMY.value: id_,
        'id_type': DatabaseType.MESH.value,
        'name': name,
        'synonym': synonym
    }


def create_ner_type_chemical(id_: str, name: str, synonym: str) -> dict:
    return {
        EntityIdStr.CHEMICAL.value: id_,
        'id_type': DatabaseType.CHEBI.value,
        'name': name,
        'synonym': synonym,
    }


def create_ner_type_compound(id_: str, name: str, synonym: str) -> dict:
    return {
        EntityIdStr.COMPOUND.value: id_,
        'id_type': DatabaseType.BIOCYC.value,
        'name': name,
        'synonym': synonym,
    }


def create_ner_type_disease(id_: str, name: str, synonym: str) -> dict:
    return {
        EntityIdStr.DISEASE.value: id_,
        'id_type': DatabaseType.MESH.value,
        'name': name,
        'synonym': synonym,
    }


def create_ner_type_food(
    id_: str,
    name: str,
    synonym: str
) -> dict:
    return {
        EntityIdStr.FOOD.value: id_,
        'id_type': DatabaseType.MESH.value,
        'name': name,
        'synonym': synonym
    }


def create_ner_type_gene(
    name: str,
    synonym: str,
    data_source: str = DatabaseType.NCBI_GENE.value
) -> dict:
    return {
        'id_type': data_source,
        'name': name,
        'synonym': synonym,
    }


def create_ner_type_phenomena(
    id_: str,
    name: str,
    synonym: str
) -> dict:
    return {
        EntityIdStr.PHENOMENA.value: id_,
        'id_type': DatabaseType.MESH.value,
        'name': name,
        'synonym': synonym,
    }


def create_ner_type_phenotype(
    id_: str,
    name: str,
    synonym: str
) -> dict:
    return {
        EntityIdStr.PHENOTYPE.value: id_,
        'id_type': DatabaseType.CUSTOM.value,
        'name': name,
        'synonym': synonym,
    }


def create_ner_type_protein(name: str, synonym: str) -> dict:
    # changed protein_id to protein_name for now (JIRA LL-671)
    # will eventually change back to protein_id
    return {
        EntityIdStr.PROTEIN.value: name,
        'id_type': DatabaseType.UNIPROT.value,
        'name': name,
        'synonym': synonym,
    }


def create_ner_type_species(
    id_: str,
    name: str,
    synonym: str,
    category: str = 'Uncategorized',
) -> dict:
    return {
        EntityIdStr.SPECIES.value: id_,
        'id_type': DatabaseType.NCBI_TAXONOMY.value,
        'category': category,
        'name': name,
        'synonym': synonym,
    }


def create_ner_type_company(id_: str, name: str, synonym: str) -> dict:
    return {
        EntityIdStr.COMPANY.value: id_,
        'id_type': DatabaseType.CUSTOM.value,
        'name': name,
        'synonym': synonym
    }


def create_ner_type_entity(id_: str, name: str, synonym: str) -> dict:
    return {
        EntityIdStr.ENTITY.value: id_,
        'id_type': DatabaseType.CUSTOM.value,
        'name': name,
        'synonym': synonym
    }
