import lmdb
import json
import pytest

from os import path, remove, walk

from neo4japp.services.annotations import AnnotationsService, AnnotationsNeo4jService, LMDBDao
from neo4japp.services.annotations.constants import (
    DatabaseType,
    OrganismCategory,
    CHEMICALS_CHEBI_LMDB,
    COMPOUNDS_BIOCYC_LMDB,
    DISEASES_MESH_LMDB,
    GENES_NCBI_LMDB,
    PHENOTYPES_MESH_LMDB,
    PROTEINS_UNIPROT_LMDB,
    CHEMICALS_PUBCHEM_LMDB,
    SPECIES_NCBI_LMDB,
)
from neo4japp.services.annotations.util import normalize_str


# reference to this directory
directory = path.realpath(path.dirname(__file__))


# Start LMDB Data Helpers
def lmdb_chemical_factory(
    chemical_id: str,
    id_type: str,
    name: str,
    synonym: str,
):
    return {
        'chemical_id': chemical_id,
        'id_type': id_type,
        'name': name,
        'synonym': synonym,
    }


def lmdb_compound_factory(
    compound_id: str,
    id_type: str,
    name: str,
    synonym: str,
):
    return {
        'compound_id': compound_id,
        'id_type': id_type,
        'name': name,
        'synonym': synonym,
    }


def lmdb_disease_factory(
    disease_id: str,
    id_type: str,
    name: str,
    synonym: str,
):
    return {
        'disease_id': disease_id,
        'id_type': id_type,
        'name': name,
        'synonym': synonym,
    }


def lmdb_gene_factory(
    gene_id: str,
    id_type: str,
    name: str,
    synonym: str,
    category: str,
):
    return {
        'gene_id': gene_id,
        'id_type': id_type,
        'name': name,
        'synonym': synonym,
        'category': category,
    }


def lmdb_phenotype_factory(
    phenotype_id: str,
    id_type: str,
    name: str,
    synonym: str,
):
    return {
        'phenotype_id': name,
        'id_type': id_type,
        'name': name,
        'synonym': synonym,
    }


def lmdb_protein_factory(
    protein_id: str,
    id_type: str,
    name: str,
    synonym: str,
):
    return {
        # changed protein_id to protein_name for now (JIRA LL-671)
        # will eventually change back to protein_id
        'protein_id': name,
        'id_type': id_type,
        'name': name,
        'synonym': synonym,
    }


def lmdb_species_factory(
    tax_id: str,
    id_type: str,
    category: str,
    name: str,
    synonym: str,
):
    return {
        'tax_id': tax_id,
        'id_type': id_type,
        'category': category,
        'name': name,
        'synonym': synonym,
    }
# End LMDB Data Helpers


def create_empty_lmdb(path_to_folder: str, db_name: str):
    map_size = 1099511627776
    env = lmdb.open(path.join(directory, path_to_folder), map_size=map_size, max_dbs=2)
    db = env.open_db(db_name.encode('utf-8'), dupsort=True)
    env.close()


def create_entity_lmdb(path_to_folder: str, db_name: str, entity_objs=[]):
    map_size = 1099511627776
    env = lmdb.open(path.join(directory, path_to_folder), map_size=map_size, max_dbs=2)
    db = env.open_db(db_name.encode('utf-8'), dupsort=True)
    with env.begin(db=db, write=True) as transaction:
        for entity in entity_objs:
            transaction.put(
                normalize_str(entity['synonym']).encode('utf-8'),
                json.dumps(entity).encode('utf-8'))


@pytest.fixture(scope='function')
def default_lmdb_setup(app, request):
    # Create gene data
    bola3 = lmdb_gene_factory(
        gene_id='388962',
        id_type=DatabaseType.Ncbi.value,
        name='BOLA3',
        synonym='BOLA3',
        category=OrganismCategory.Eukaryota.value,
    )

    hyp27_gene = lmdb_gene_factory(
        gene_id='2846957',
        id_type=DatabaseType.Ncbi.value,
        name='hyp27',
        synonym='hyp27',
        category=OrganismCategory.Eukaryota.value,
    )

    serpina1_gene = lmdb_gene_factory(
        gene_id='5265',
        id_type=DatabaseType.Ncbi.value,
        name='SERPINA1',
        synonym='SERPINA1',
        category=OrganismCategory.Eukaryota.value,
    )

    serpina1_gene2 = lmdb_gene_factory(
        gene_id='322701',
        id_type=DatabaseType.Ncbi.value,
        name='serpina1',
        synonym='serpina1',
        category=OrganismCategory.Eukaryota.value,
    )

    # Create phenotype data
    whey_protein = lmdb_phenotype_factory(
        phenotype_id='MESH:D000067816',
        id_type=DatabaseType.Mesh.value,
        name='Whey Proteins',
        synonym='Whey Proteins',
    )

    # Create protein data
    hyp27_protein = lmdb_protein_factory(
        protein_id='Y1954_CLOPE',
        id_type=DatabaseType.Uniprot.value,
        name='Hyp27',
        synonym='Hyp27',
    )

    wasabi = lmdb_protein_factory(
        protein_id='KKX1U_UROMN',
        id_type=DatabaseType.Uniprot.value,
        name='Wasabi receptor toxin',
        synonym='Wasabi receptor toxin',
    )
    ns2a = lmdb_protein_factory(
        protein_id='NS2A_CVBM',
        id_type=DatabaseType.Uniprot.value,
        name='ns2a',
        synonym='ns2a',
    )

    NS2A = lmdb_protein_factory(
        protein_id='POLG_ZIKVK',
        id_type=DatabaseType.Uniprot.value,
        name='NS2A',
        synonym='NS2A',
    )

    serpina1_protein = lmdb_protein_factory(
        protein_id='A1AT_PONAB',
        id_type=DatabaseType.Uniprot.value,
        name='Serpin A1',
        synonym='Serpin A1',
    )

    # Create species data
    human = lmdb_species_factory(
        tax_id='9606',
        category=OrganismCategory.Eukaryota.value,
        id_type=DatabaseType.Ncbi.value,
        name='human',
        synonym='human',
    )

    rat = lmdb_species_factory(
        tax_id='10114',
        category=OrganismCategory.Eukaryota.value,
        id_type=DatabaseType.Ncbi.value,
        name='rat',
        synonym='rat',
    )

    moniliophthora_roreri = lmdb_species_factory(
        tax_id='221103',
        category=OrganismCategory.Eukaryota.value,
        id_type=DatabaseType.Ncbi.value,
        name='Moniliophthora roreri',
        synonym='Moniliophthora roreri',
    )

    # Create chemical data
    arginine = lmdb_chemical_factory(
        chemical_id='CHEBI:29952',
        id_type=DatabaseType.Chebi.value,
        name='L-arginine residue',
        synonym='Arg',
    )

    hypofluorite = lmdb_chemical_factory(
        chemical_id='CHEBI:30244',
        id_type=DatabaseType.Chebi.value,
        name='hypofluorite',
        synonym='FO(-)',
    )

    histidine = lmdb_chemical_factory(
        chemical_id='CHEBI:29979',
        id_type=DatabaseType.Chebi.value,
        name='L-histidine residue',
        synonym='H',
    )

    adenosine = lmdb_chemical_factory(
        chemical_id='CHEBI:16335',
        id_type=DatabaseType.Chebi.value,
        name='adenosine',
        synonym='adenosine',
    )

    adenosine2 = lmdb_compound_factory(
        compound_id='ADENOSINE',
        id_type=DatabaseType.Biocyc.value,
        name='adenosine',
        synonym='adenosine',
    )

    guanosine = lmdb_compound_factory(
        compound_id='GUANOSINE',
        id_type=DatabaseType.Biocyc.value,
        name='guanosine',
        synonym='guanosine',
    )

    # Create disease data
    cold_sore = lmdb_disease_factory(
        disease_id='MESH:D006560',
        id_type=DatabaseType.Mesh.value,
        name='cold sore',
        synonym='cold sore',
    )

    entities = [
        (CHEMICALS_CHEBI_LMDB, 'chemicals', [adenosine, arginine, hypofluorite, histidine]),
        (COMPOUNDS_BIOCYC_LMDB, 'compounds', [adenosine2, guanosine]),
        (DISEASES_MESH_LMDB, 'diseases', [cold_sore]),
        (GENES_NCBI_LMDB, 'genes', [bola3, hyp27_gene, serpina1_gene, serpina1_gene2]),
        (PHENOTYPES_MESH_LMDB, 'phenotypes', [whey_protein]),
        (PROTEINS_UNIPROT_LMDB, 'proteins', [hyp27_protein, serpina1_protein, wasabi, ns2a, NS2A]),
        (SPECIES_NCBI_LMDB, 'species', [human, moniliophthora_roreri, rat]),
    ]
    for db_name, entity, data in entities:
        create_entity_lmdb(f'lmdb/{entity}', db_name, data)

    def teardown():
        for parent, subfolders, filenames in walk(path.join(directory, 'lmdb/')):
            for fn in filenames:
                if fn.lower().endswith('.mdb'):
                    remove(path.join(parent, fn))

    request.addfinalizer(teardown)


@pytest.fixture(scope='function')
def human_gene_pdf_lmdb_setup(app, request):
    # Create gene data
    ace2 = lmdb_gene_factory(
        gene_id='59272',
        id_type=DatabaseType.Ncbi.value,
        name='ACE2',
        synonym='ACE2',
        category=OrganismCategory.Eukaryota.value,
    )

    # Create disease data
    covid_19 = lmdb_disease_factory(
        disease_id='MESH:C000657245',
        id_type=DatabaseType.Mesh.value,
        name='COVID-19',
        synonym='COVID-19',
    )

    # Create species data
    mers_cov = lmdb_species_factory(
        tax_id='1335626',
        category=OrganismCategory.Viruses.value,
        id_type=DatabaseType.Ncbi.value,
        name='MERS-CoV',
        synonym='MERS-CoV',
    )

    entities = [
        (CHEMICALS_CHEBI_LMDB, 'chemicals', []),
        (COMPOUNDS_BIOCYC_LMDB, 'compounds', []),
        (DISEASES_MESH_LMDB, 'diseases', [covid_19]),
        (GENES_NCBI_LMDB, 'genes', [ace2]),
        (PHENOTYPES_MESH_LMDB, 'phenotypes', []),
        (PROTEINS_UNIPROT_LMDB, 'proteins', []),
        (SPECIES_NCBI_LMDB, 'species', [mers_cov]),
    ]
    for db_name, entity, data in entities:
        create_entity_lmdb(f'lmdb/{entity}', db_name, data)

    def teardown():
        for parent, subfolders, filenames in walk(path.join(directory, 'lmdb/')):
            for fn in filenames:
                if fn.lower().endswith('.mdb'):
                    remove(path.join(parent, fn))

    request.addfinalizer(teardown)


@pytest.fixture(scope='function')
def escherichia_coli_pdf_lmdb_setup(app, request):
    # Create gene data
    purA = lmdb_gene_factory(
        gene_id='948695',
        id_type=DatabaseType.Ncbi.value,
        name='purA',
        synonym='purA',
        category=OrganismCategory.Eukaryota.value,
    )

    purB = lmdb_gene_factory(
        gene_id='945695',
        id_type=DatabaseType.Ncbi.value,
        name='purB',
        synonym='purB',
        category=OrganismCategory.Eukaryota.value,
    )

    purC = lmdb_gene_factory(
        gene_id='946957',
        id_type=DatabaseType.Ncbi.value,
        name='purC',
        synonym='purC',
        category=OrganismCategory.Eukaryota.value,
    )

    purD = lmdb_gene_factory(
        gene_id='948504',
        id_type=DatabaseType.Ncbi.value,
        name='purF',
        synonym='purF',
        category=OrganismCategory.Eukaryota.value,
    )

    purF = lmdb_gene_factory(
        gene_id='946794',
        id_type=DatabaseType.Ncbi.value,
        name='purD',
        synonym='purD',
        category=OrganismCategory.Eukaryota.value,
    )

    # Create species data
    e_coli = lmdb_species_factory(
        tax_id='562',
        category=OrganismCategory.Bacteria.value,
        id_type=DatabaseType.Ncbi.value,
        name='Escherichia coli',
        synonym='Escherichia coli',
    )

    entities = [
        (CHEMICALS_CHEBI_LMDB, 'chemicals', []),
        (COMPOUNDS_BIOCYC_LMDB, 'compounds', []),
        (DISEASES_MESH_LMDB, 'diseases', []),
        (GENES_NCBI_LMDB, 'genes', [purA, purB, purC, purD, purF]),
        (PHENOTYPES_MESH_LMDB, 'phenotypes', []),
        (PROTEINS_UNIPROT_LMDB, 'proteins', []),
        (SPECIES_NCBI_LMDB, 'species', [e_coli]),
    ]
    for db_names, entity, data in entities:
        create_entity_lmdb(f'lmdb/{entity}', db_names, data)

    def teardown():
        for parent, subfolders, filenames in walk(path.join(directory, 'lmdb/')):
            for fn in filenames:
                if fn.lower().endswith('.mdb'):
                    remove(path.join(parent, fn))

    request.addfinalizer(teardown)


@pytest.fixture(scope='function')
def human_rat_gene_lmdb_setup(app, request):
    # Create gene data
    edem3 = lmdb_gene_factory(
        gene_id='289085',
        id_type=DatabaseType.Ncbi.value,
        name='Edem3',
        synonym='Edem3',
        category=OrganismCategory.Eukaryota.value,
    )

    edem3_caps = lmdb_gene_factory(
        gene_id='80267',
        id_type=DatabaseType.Ncbi.value,
        name='EDEM3',
        synonym='EDEM3',
        category=OrganismCategory.Eukaryota.value,
    )

    # Create species data
    human = lmdb_species_factory(
        tax_id='9606',
        category=OrganismCategory.Eukaryota.value,
        id_type=DatabaseType.Ncbi.value,
        name='human',
        synonym='human',
    )

    rat = lmdb_species_factory(
        tax_id='10116',
        category=OrganismCategory.Eukaryota.value,
        id_type=DatabaseType.Ncbi.value,
        name='rat',
        synonym='rat',
    )

    entities = [
        (CHEMICALS_CHEBI_LMDB, 'chemicals', []),
        (COMPOUNDS_BIOCYC_LMDB, 'compounds', []),
        (DISEASES_MESH_LMDB, 'diseases', []),
        (GENES_NCBI_LMDB, 'genes', [edem3, edem3_caps]),
        (PHENOTYPES_MESH_LMDB, 'phenotypes', []),
        (PROTEINS_UNIPROT_LMDB, 'proteins', []),
        (SPECIES_NCBI_LMDB, 'species', [human, rat]),
    ]
    for db_name, entity, data in entities:
        create_entity_lmdb(f'lmdb/{entity}', db_name, data)

    def teardown():
        for parent, subfolders, filenames in walk(path.join(directory, 'lmdb/')):
            for fn in filenames:
                if fn.lower().endswith('.mdb'):
                    remove(path.join(parent, fn))

    request.addfinalizer(teardown)


@pytest.fixture(scope='function')
def fish_gene_lmdb_setup(app, request):
    # Create gene data
    IL7 = lmdb_gene_factory(
        gene_id='102353780',
        id_type=DatabaseType.Ncbi.value,
        name='IL7',
        synonym='IL7',
        category=OrganismCategory.Eukaryota.value,
    )

    il7 = lmdb_gene_factory(
        gene_id='100191071',
        id_type=DatabaseType.Ncbi.value,
        name='il-7',
        synonym='il-7',
        category=OrganismCategory.Eukaryota.value,
    )

    # Create species data
    tetraodon = lmdb_species_factory(
        tax_id='31033',
        category=OrganismCategory.Eukaryota.value,
        id_type=DatabaseType.Ncbi.value,
        name='Tetraodon rubripes',
        synonym='Tetraodon rubripes',
    )

    coelacanth = lmdb_species_factory(
        tax_id='7897',
        category=OrganismCategory.Eukaryota.value,
        id_type=DatabaseType.Ncbi.value,
        name='coelacanth',
        synonym='coelacanth',
    )

    entities = [
        (CHEMICALS_CHEBI_LMDB, 'chemicals', []),
        (COMPOUNDS_BIOCYC_LMDB, 'compounds', []),
        (DISEASES_MESH_LMDB, 'diseases', []),
        (GENES_NCBI_LMDB, 'genes', [IL7, il7]),
        (PHENOTYPES_MESH_LMDB, 'phenotypes', []),
        (PROTEINS_UNIPROT_LMDB, 'proteins', []),
        (SPECIES_NCBI_LMDB, 'species', [coelacanth, tetraodon]),
    ]
    for db_name, entity, data in entities:
        create_entity_lmdb(f'lmdb/{entity}', db_name, data)

    def teardown():
        for parent, subfolders, filenames in walk(path.join(directory, 'lmdb/')):
            for fn in filenames:
                if fn.lower().endswith('.mdb'):
                    remove(path.join(parent, fn))

    request.addfinalizer(teardown)


################################################################################
# Start monkeypatch mocks here
# doc on how to monkeypatch: https://docs.pytest.org/en/latest/monkeypatch.html
###############################################################################
@pytest.fixture(scope='function')
def mock_empty_gene_to_organism(monkeypatch):
    def get_match_result(*args, **kwargs):
        return {}

    monkeypatch.setattr(
        AnnotationsNeo4jService,
        'get_gene_to_organism_match_result',
        get_match_result,
    )


@pytest.fixture(scope='function')
def mock_general_human_genes(monkeypatch):
    def get_match_result(*args, **kwargs):
        return {'BOLA3': {'9606': '388962'}}

    monkeypatch.setattr(
        AnnotationsNeo4jService,
        'get_gene_to_organism_match_result',
        get_match_result,
    )


@pytest.fixture(scope='function')
def mock_get_gene_to_organism_match_result(monkeypatch):
    def get_match_result(*args, **kwargs):
        # match to 'Moniliophthora roreri' in create_species_lmdb()
        return {'hyp27': {'221103': '2846957'}}

    monkeypatch.setattr(
        AnnotationsNeo4jService,
        'get_gene_to_organism_match_result',
        get_match_result,
    )


@pytest.fixture(scope='function')
def mock_get_gene_to_organism_serpina1_match_result(monkeypatch):
    def get_match_result(*args, **kwargs):
        return {'serpina1': {'9606': '5265'}}

    monkeypatch.setattr(
        AnnotationsNeo4jService,
        'get_gene_to_organism_match_result',
        get_match_result,
    )


@pytest.fixture(scope='function')
def mock_get_gene_to_organism_serpina1_match_result_all_caps(monkeypatch):
    def get_match_result(*args, **kwargs):
        return {'SERPINA1': {'9606': '5265'}}

    monkeypatch.setattr(
        AnnotationsNeo4jService,
        'get_gene_to_organism_match_result',
        get_match_result,
    )


@pytest.fixture(scope='function')
def mock_get_gene_to_organism_match_result_for_fish_gene(monkeypatch):
    def get_match_result(*args, **kwargs):
        return {'IL7': {'7897': '102353780'}, 'il-7': {'31033': '99999'}}

    monkeypatch.setattr(
        AnnotationsNeo4jService,
        'get_gene_to_organism_match_result',
        get_match_result,
    )


@pytest.fixture(scope='function')
def mock_get_gene_to_organism_match_result_for_human_gene_pdf(monkeypatch):
    def get_match_result(*args, **kwargs):
        return {'ACE2': {'9606': '59272'}}

    monkeypatch.setattr(
        AnnotationsNeo4jService,
        'get_gene_to_organism_match_result',
        get_match_result,
    )


@pytest.fixture(scope='function')
def mock_get_gene_to_organism_match_result_for_human_rat_gene(monkeypatch):
    def get_match_result(*args, **kwargs):
        return {'EDEM3': {'9606': '80267'}, 'Edem3': {'10116': '289085'}}

    monkeypatch.setattr(
        AnnotationsNeo4jService,
        'get_gene_to_organism_match_result',
        get_match_result,
    )


@pytest.fixture(scope='function')
def mock_get_gene_to_organism_match_result_for_escherichia_coli_pdf(monkeypatch):
    def get_match_result(*args, **kwargs):
        return {
            'purA': {'562': '948695'},
            'purB': {'562': '945695'},
            'purC': {'562': '946957'},
            'purD': {'562': '948504'},
            'purF': {'562': '946794'},
        }

    monkeypatch.setattr(
        AnnotationsNeo4jService,
        'get_gene_to_organism_match_result',
        get_match_result,
    )


@pytest.fixture(scope='function')
def mock_global_compound_exclusion(monkeypatch):
    def get_exclusions(*args, **kwargs):
        return {'guanosine', 'hydrogen'}

    monkeypatch.setattr(
        AnnotationsService,
        'get_compound_annotations_to_exclude',
        get_exclusions,
    )


@pytest.fixture(scope='function')
def mock_global_chemical_exclusion(monkeypatch):
    def get_exclusions(*args, **kwargs):
        return {'hypofluorite', 'hydrogen', 'adenosine'}

    monkeypatch.setattr(
        AnnotationsService,
        'get_chemical_annotations_to_exclude',
        get_exclusions,
    )


@pytest.fixture(scope='function')
def mock_global_disease_exclusion(monkeypatch):
    def get_exclusions(*args, **kwargs):
        return {'cold sore'}

    monkeypatch.setattr(
        AnnotationsService,
        'get_disease_annotations_to_exclude',
        get_exclusions,
    )


@pytest.fixture(scope='function')
def mock_global_gene_exclusion(monkeypatch):
    def get_exclusions(*args, **kwargs):
        return {'BOLA3', 'rpoS'}

    monkeypatch.setattr(
        AnnotationsService,
        'get_gene_annotations_to_exclude',
        get_exclusions,
    )


@pytest.fixture(scope='function')
def mock_global_phenotype_exclusion(monkeypatch):
    def get_exclusions(*args, **kwargs):
        return {'Whey Proteins'}

    monkeypatch.setattr(
        AnnotationsService,
        'get_phenotype_annotations_to_exclude',
        get_exclusions,
    )


@pytest.fixture(scope='function')
def mock_global_protein_exclusion(monkeypatch):
    def get_exclusions(*args, **kwargs):
        return {'Wasabi receptor toxin'}

    monkeypatch.setattr(
        AnnotationsService,
        'get_protein_annotations_to_exclude',
        get_exclusions,
    )


@pytest.fixture(scope='function')
def mock_global_species_exclusion(monkeypatch):
    def get_exclusions(*args, **kwargs):
        return {'human', 'dog'}

    monkeypatch.setattr(
        AnnotationsService,
        'get_species_annotations_to_exclude',
        get_exclusions,
    )


@pytest.fixture(scope='function')
def annotations_setup(app):
    pass


@pytest.fixture(scope='function')
def get_annotation_n4j(neo4j_service_dao, session):
    return AnnotationsNeo4jService(
        neo4j_service=neo4j_service_dao, session=session)


@pytest.fixture(scope='function')
def get_lmdb():
    for db_name, entity in [
        (CHEMICALS_CHEBI_LMDB, 'chemicals'),
        (COMPOUNDS_BIOCYC_LMDB, 'compounds'),
        (GENES_NCBI_LMDB, 'genes'),
        (DISEASES_MESH_LMDB, 'diseases'),
        (PROTEINS_UNIPROT_LMDB, 'proteins'),
        (PHENOTYPES_MESH_LMDB, 'phenotypes'),
        (SPECIES_NCBI_LMDB, 'species'),
    ]:
        create_empty_lmdb(f'lmdb/{entity}', db_name)

    genes_lmdb_path = path.join(directory, 'lmdb/genes')
    chemicals_lmdb_path = path.join(directory, 'lmdb/chemicals')
    compounds_lmdb_path = path.join(directory, 'lmdb/compounds')
    proteins_lmdb_path = path.join(directory, 'lmdb/proteins')
    species_lmdb_path = path.join(directory, 'lmdb/species')
    diseases_lmdb_path = path.join(directory, 'lmdb/diseases')
    phenotypes_lmdb_path = path.join(directory, 'lmdb/phenotypes')

    return LMDBDao(
        genes_lmdb_path=genes_lmdb_path,
        chemicals_lmdb_path=chemicals_lmdb_path,
        compounds_lmdb_path=compounds_lmdb_path,
        proteins_lmdb_path=proteins_lmdb_path,
        species_lmdb_path=species_lmdb_path,
        diseases_lmdb_path=diseases_lmdb_path,
        phenotypes_lmdb_path=phenotypes_lmdb_path,
    )


@pytest.fixture(scope='function')
def get_annotations_service(
    get_annotation_n4j,
    get_lmdb,
    request
):
    def teardown():
        for parent, subfolders, filenames in walk(path.join(directory, 'lmdb/')):
            for fn in filenames:
                if fn.lower().endswith('.mdb'):
                    remove(path.join(parent, fn))

    request.addfinalizer(teardown)

    return AnnotationsService(
        lmdb_session=get_lmdb,
        annotation_neo4j=get_annotation_n4j,
    )
