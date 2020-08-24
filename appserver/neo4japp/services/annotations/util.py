from string import punctuation, whitespace

from unidecode import unidecode

from .constants import DatabaseType, EntityIdStr


def clean_char(c) -> str:
    # pdfminer does not correctly convert
    # convert all unicode characters to nearest ascii
    return unidecode(c)


def normalize_str(s) -> str:
    normalized = clean_char(s).lower()
    normalized = normalized.translate(str.maketrans('', '', punctuation))
    return normalized.translate(str.maketrans('', '', whitespace))


def create_chemical_for_ner(chemical_id: str, name: str, synonym: str) -> dict:
    return {
        EntityIdStr.Chemical.value: chemical_id,
        'id_type': DatabaseType.Chebi.value,
        'name': name,
        'synonym': synonym,
    }


def create_compound_for_ner(compound_id: str, name: str, synonym: str) -> dict:
    return {
        EntityIdStr.Compound.value: compound_id,
        'id_type': DatabaseType.Biocyc.value,
        'name': name,
        'synonym': synonym,
    }


def create_disease_for_ner(disease_id: str, name: str, synonym: str) -> dict:
    return {
        EntityIdStr.Disease.value: disease_id,
        'id_type': DatabaseType.Mesh.value,
        'name': name,
        'synonym': synonym,
    }


def create_gene_for_ner(name: str, synonym: str) -> dict:
    return {
        'id_type': DatabaseType.Ncbi.value,
        'name': name,
        'synonym': synonym,
    }


def create_phenotype_for_ner(phenotype_id: str, name: str, synonym: str) -> dict:
    return {
        EntityIdStr.Phenotype.value: phenotype_id,
        'id_type': DatabaseType.Mesh.value,
        'name': name,
        'synonym': synonym,
    }


def create_protein_for_ner(name: str, synonym: str) -> dict:
    # changed protein_id to protein_name for now (JIRA LL-671)
    # will eventually change back to protein_id
    return {
        EntityIdStr.Protein.value: name,
        'id_type': DatabaseType.Uniprot.value,
        'name': name,
        'synonym': synonym,
    }


def create_species_for_ner(
    species_id: str,
    name: str,
    synonym: str,
    category: str = 'Uncategorized',
) -> dict:
    return {
        EntityIdStr.Species.value: species_id,
        'id_type': DatabaseType.Ncbi.value,
        'category': category,
        'name': name,
        'synonym': synonym,
    }
