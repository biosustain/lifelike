import lmdb
import json
import pytest

from os import path, remove, walk

from neo4japp.higher_order_services import HybridNeo4jPostgresService
from neo4japp.services.annotations import prepare_databases
from neo4japp.services.annotations.constants import (
    DatabaseType,
    OrganismCategory,
    CHEMICAL_LMDB,
    COMPOUND_LMDB,
    DISEASE_LMDB,
    GENE_LMDB,
    PHENOTYPE_LMDB,
    PROTEIN_LMDB,
    PUBCHEM_LMDB,
    SPECIES_LMDB,
)
from neo4japp.services.annotations.util import normalize_str


# reference to this directory
directory = path.realpath(path.dirname(__file__))


# Start LMDB Data Helpers
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

    # Create protein data
    hyp27_protein = lmdb_protein_factory(
        protein_id='Y1954_CLOPE',
        id_type=DatabaseType.Uniprot.value,
        name='Hyp27',
        synonym='Hyp27',
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

    moniliophthora_roreri = lmdb_species_factory(
        tax_id='221103',
        category=OrganismCategory.Eukaryota.value,
        id_type=DatabaseType.Ncbi.value,
        name='Moniliophthora roreri',
        synonym='Moniliophthora roreri',
    )

    entities = [
        (CHEMICAL_LMDB, 'chemicals', []),  # TODO: Create test chemical data
        (COMPOUND_LMDB, 'compounds', []),  # TODO: Create test compound data
        (DISEASE_LMDB, 'diseases', []),  # TODO: Create test disease data
        (GENE_LMDB, 'genes', [hyp27_gene, serpina1_gene, serpina1_gene2]),
        (PHENOTYPE_LMDB, 'phenotypes', []),  # TODO: Create test phenotype data
        (PROTEIN_LMDB, 'proteins', [hyp27_protein, serpina1_protein]),
        (SPECIES_LMDB, 'species', [human, moniliophthora_roreri]),
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
        (CHEMICAL_LMDB, 'chemicals', []),
        (COMPOUND_LMDB, 'compounds', []),
        (DISEASE_LMDB, 'diseases', [covid_19]),
        (GENE_LMDB, 'genes', [ace2]),
        (PHENOTYPE_LMDB, 'phenotypes', []),
        (PROTEIN_LMDB, 'proteins', []),
        (SPECIES_LMDB, 'species', [mers_cov]),
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
        (CHEMICAL_LMDB, 'chemicals', []),
        (COMPOUND_LMDB, 'compounds', []),
        (DISEASE_LMDB, 'diseases', []),
        (GENE_LMDB, 'genes', [purA, purB, purC, purD, purF]),
        (PHENOTYPE_LMDB, 'phenotypes', []),
        (PROTEIN_LMDB, 'proteins', []),
        (SPECIES_LMDB, 'species', [e_coli]),
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
        (CHEMICAL_LMDB, 'chemicals', []),
        (COMPOUND_LMDB, 'compounds', []),
        (DISEASE_LMDB, 'diseases', []),
        (GENE_LMDB, 'genes', [edem3, edem3_caps]),
        (PHENOTYPE_LMDB, 'phenotypes', []),
        (PROTEIN_LMDB, 'proteins', []),
        (SPECIES_LMDB, 'species', [human, rat]),
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
        (CHEMICAL_LMDB, 'chemicals', []),
        (COMPOUND_LMDB, 'compounds', []),
        (DISEASE_LMDB, 'diseases', []),
        (GENE_LMDB, 'genes', [IL7, il7]),
        (PHENOTYPE_LMDB, 'phenotypes', []),
        (PROTEIN_LMDB, 'proteins', []),
        (SPECIES_LMDB, 'species', [coelacanth, tetraodon]),
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
def mock_get_gene_to_organism_match_result(monkeypatch):
    def get_match_result(*args, **kwargs):
        # match to 'Moniliophthora roreri' in create_species_lmdb()
        return {'hyp27': {'221103': '2846957'}}

    monkeypatch.setattr(
        HybridNeo4jPostgresService,
        'get_gene_to_organism_match_result',
        get_match_result,
    )


@pytest.fixture(scope='function')
def mock_get_gene_to_organism_serpina1_match_result(monkeypatch):
    def get_match_result(*args, **kwargs):
        return {'serpina1': {'9606': '5265'}}

    monkeypatch.setattr(
        HybridNeo4jPostgresService,
        'get_gene_to_organism_match_result',
        get_match_result,
    )


@pytest.fixture(scope='function')
def mock_get_gene_to_organism_serpina1_match_result_all_caps(monkeypatch):
    def get_match_result(*args, **kwargs):
        return {'SERPINA1': {'9606': '5265'}}

    monkeypatch.setattr(
        HybridNeo4jPostgresService,
        'get_gene_to_organism_match_result',
        get_match_result,
    )


@pytest.fixture(scope='function')
def mock_get_gene_to_organism_match_result_for_fish_gene(monkeypatch):
    def get_match_result(*args, **kwargs):
        return {'IL7': {'7897': '102353780'}, 'il-7': {'31033': '99999'}}

    monkeypatch.setattr(
        HybridNeo4jPostgresService,
        'get_gene_to_organism_match_result',
        get_match_result,
    )


@pytest.fixture(scope='function')
def mock_get_gene_to_organism_match_result_for_human_gene_pdf(monkeypatch):
    def get_match_result(*args, **kwargs):
        return {'ACE2': {'9606': '59272'}}

    monkeypatch.setattr(
        HybridNeo4jPostgresService,
        'get_gene_to_organism_match_result',
        get_match_result,
    )


@pytest.fixture(scope='function')
def mock_get_gene_to_organism_match_result_for_human_rat_gene(monkeypatch):
    def get_match_result(*args, **kwargs):
        return {'EDEM3': {'9606': '80267'}, 'Edem3': {'10116': '289085'}}

    monkeypatch.setattr(
        HybridNeo4jPostgresService,
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
        HybridNeo4jPostgresService,
        'get_gene_to_organism_match_result',
        get_match_result,
    )


@pytest.fixture(scope='function')
def annotations_setup(app):
    pass
