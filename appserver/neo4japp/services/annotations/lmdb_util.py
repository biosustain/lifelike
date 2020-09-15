from neo4japp.services.annotations.constants import DatabaseType, EntityIdStr


def create_chemical_for_ner(id_: str, name: str, synonym: str) -> dict:
    return {
        EntityIdStr.CHEMICAL.value: id_,
        'id_type': DatabaseType.CHEBI.value,
        'name': name,
        'synonym': synonym,
    }


def create_compound_for_ner(id_: str, name: str, synonym: str) -> dict:
    return {
        EntityIdStr.COMPOUND.value: id_,
        'id_type': DatabaseType.BIOCYC.value,
        'name': name,
        'synonym': synonym,
    }


def create_disease_for_ner(id_: str, name: str, synonym: str) -> dict:
    return {
        EntityIdStr.DISEASE.value: id_,
        'id_type': DatabaseType.MESH.value,
        'name': name,
        'synonym': synonym,
    }


def create_gene_for_ner(name: str, synonym: str) -> dict:
    return {
        'id_type': DatabaseType.NCBI.value,
        'name': name,
        'synonym': synonym,
    }


def create_phenotype_for_ner(
    id_: str,
    name: str,
    synonym: str,
    custom: bool = False
) -> dict:
    return {
        EntityIdStr.PHENOTYPE.value: id_,
        'id_type': DatabaseType.MESH.value if not custom else DatabaseType.CUSTOM.value,
        'name': name,
        'synonym': synonym,
    }


def create_protein_for_ner(name: str, synonym: str) -> dict:
    # changed protein_id to protein_name for now (JIRA LL-671)
    # will eventually change back to protein_id
    return {
        EntityIdStr.PROTEIN.value: name,
        'id_type': DatabaseType.UNIPROT.value,
        'name': name,
        'synonym': synonym,
    }


def create_species_for_ner(
    id_: str,
    name: str,
    synonym: str,
    category: str = 'Uncategorized',
) -> dict:
    return {
        EntityIdStr.SPECIES.value: id_,
        'id_type': DatabaseType.NCBI.value,
        'category': category,
        'name': name,
        'synonym': synonym,
    }
