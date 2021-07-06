import lmdb
import json
import pytest

from os import path, remove, walk

from neo4japp.database import DBConnection, GraphConnection
from neo4japp.services.annotations import (
    AnnotationService,
    AnnotationDBService,
    AnnotationGraphService,
    LMDBService,
    ManualAnnotationService
)
from neo4japp.services.annotations.constants import (
    OrganismCategory,
    ANATOMY_MESH_LMDB,
    CHEMICALS_CHEBI_LMDB,
    COMPOUNDS_BIOCYC_LMDB,
    DISEASES_MESH_LMDB,
    FOODS_MESH_LMDB,
    GENES_NCBI_LMDB,
    PHENOMENAS_MESH_LMDB,
    PHENOTYPES_CUSTOM_LMDB,
    PROTEINS_UNIPROT_LMDB,
    SPECIES_NCBI_LMDB
)
from neo4japp.services.annotations.data_transfer_objects import Inclusion
from neo4japp.services.annotations.utils.lmdb import (
    create_ner_type_anatomy,
    create_ner_type_chemical,
    create_ner_type_compound,
    create_ner_type_disease,
    create_ner_type_food,
    create_ner_type_gene,
    create_ner_type_phenomena,
    create_ner_type_phenotype,
    create_ner_type_protein,
    create_ner_type_species
)
from neo4japp.util import normalize_str


# reference to this directory
directory = path.realpath(path.dirname(__file__))


def teardown():
    for parent, subfolders, filenames in walk(path.join(directory, 'lmdb/')):
        for fn in filenames:
            if fn.lower().endswith('.mdb'):
                remove(path.join(parent, fn))


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
def get_graph_service(graph):
    class MockGraphConnection(GraphConnection):
        def __init__(self):
            super().__init__()
            self.graph = graph

    class MockAnnotationGraphService(MockGraphConnection, AnnotationGraphService):
        def __init__(self):
            super().__init__()

    return MockAnnotationGraphService()


@pytest.fixture(scope='function')
def get_db_service(session):
    class MockDBConnection(DBConnection):
        def __init__(self):
            super().__init__()
            self.session = session

    class MockAnnotationDBService(MockDBConnection, AnnotationDBService):
        def __init__(self):
            super().__init__()

    return MockAnnotationDBService()


@pytest.fixture(scope='function')
def get_annotation_service(get_db_service, get_graph_service, request):
    request.addfinalizer(teardown)

    return AnnotationService(db=get_db_service, graph=get_graph_service)


@pytest.fixture(scope='function')
def get_manual_annotation_service(get_graph_service):
    return ManualAnnotationService(graph=get_graph_service)


@pytest.fixture(scope='function')
def get_lmdb_service(request):
    request.addfinalizer(teardown)

    configs = [
        (ANATOMY_MESH_LMDB, 'anatomy'),
        (CHEMICALS_CHEBI_LMDB, 'chemicals'),
        (COMPOUNDS_BIOCYC_LMDB, 'compounds'),
        (FOODS_MESH_LMDB, 'foods'),
        (GENES_NCBI_LMDB, 'genes'),
        (DISEASES_MESH_LMDB, 'diseases'),
        (PROTEINS_UNIPROT_LMDB, 'proteins'),
        (PHENOMENAS_MESH_LMDB, 'phenomenas'),
        (PHENOTYPES_CUSTOM_LMDB, 'phenotypes'),
        (SPECIES_NCBI_LMDB, 'species'),
    ]

    for db_name, entity in configs:
        create_empty_lmdb(f'lmdb/{entity}', db_name)

    class MockLMDBService(LMDBService):
        def __init__(self, dirpath, **kwargs):
            super().__init__(dirpath, **kwargs)

    return MockLMDBService(
        f'{directory}/lmdb/',
        **{db_name: path for db_name, path in configs})


@pytest.fixture(scope='function')
def lmdb_setup_test_local_inclusion_affect_gene_organism_matching(app):
    bola3 = create_ner_type_gene(name='BOLA3', synonym='BOLA3')

    entities = [
        (ANATOMY_MESH_LMDB, 'anatomy', []),
        (CHEMICALS_CHEBI_LMDB, 'chemicals', []),
        (COMPOUNDS_BIOCYC_LMDB, 'compounds', []),
        (DISEASES_MESH_LMDB, 'diseases', []),
        (FOODS_MESH_LMDB, 'foods', []),
        (GENES_NCBI_LMDB, 'genes', [bola3]),
        (PHENOTYPES_CUSTOM_LMDB, 'phenotypes', []),
        (PROTEINS_UNIPROT_LMDB, 'proteins', []),
        (SPECIES_NCBI_LMDB, 'species', []),
    ]
    for db_name, entity, data in entities:
        create_entity_lmdb(f'lmdb/{entity}', db_name, data)


@pytest.fixture(scope='function')
def lmdb_setup_test_gene_vs_protein(app):
    hyp27_gene = create_ner_type_gene(name='hyp27', synonym='hyp27')
    serpina1_gene1 = create_ner_type_gene(name='SERPINA1', synonym='SERPINA1')
    serpina1_gene2 = create_ner_type_gene(name='serpina1', synonym='serpina1')

    hyp27_protein = create_ner_type_protein(name='Hyp27', synonym='Hyp27')
    serpina1_protein = create_ner_type_protein(name='Serpin A1', synonym='Serpin A1')

    human = create_ner_type_species(
        id_='9606',
        category=OrganismCategory.EUKARYOTA.value,
        name='human',
        synonym='human',
    )

    moni_roreri = create_ner_type_species(
        id_='221103',
        category=OrganismCategory.EUKARYOTA.value,
        name='Moniliophthora roreri',
        synonym='Moniliophthora roreri',
    )

    entities = [
        (ANATOMY_MESH_LMDB, 'anatomy', []),
        (CHEMICALS_CHEBI_LMDB, 'chemicals', []),
        (COMPOUNDS_BIOCYC_LMDB, 'compounds', []),
        (DISEASES_MESH_LMDB, 'diseases', []),
        (FOODS_MESH_LMDB, 'foods', []),
        (GENES_NCBI_LMDB, 'genes', [hyp27_gene, serpina1_gene1, serpina1_gene2]),
        (PHENOTYPES_CUSTOM_LMDB, 'phenotypes', []),
        (PROTEINS_UNIPROT_LMDB, 'proteins', [hyp27_protein, serpina1_protein]),
        (SPECIES_NCBI_LMDB, 'species', [human, moni_roreri]),
    ]
    for db_name, entity, data in entities:
        create_entity_lmdb(f'lmdb/{entity}', db_name, data)


@pytest.fixture(scope='function')
def lmdb_setup_test_global_excluded_chemical_annotations(app):
    rat = create_ner_type_species(
        id_='10114',
        category=OrganismCategory.EUKARYOTA.value,
        name='rat',
        synonym='rat',
    )

    hypofluorite = create_ner_type_chemical(
        id_='CHEBI:30244',
        name='hypofluorite',
        synonym='Hypofluorite',
    )

    entities = [
        (ANATOMY_MESH_LMDB, 'anatomy', []),
        (CHEMICALS_CHEBI_LMDB, 'chemicals', [hypofluorite]),
        (COMPOUNDS_BIOCYC_LMDB, 'compounds', []),
        (DISEASES_MESH_LMDB, 'diseases', []),
        (FOODS_MESH_LMDB, 'foods', []),
        (GENES_NCBI_LMDB, 'genes', []),
        (PHENOTYPES_CUSTOM_LMDB, 'phenotypes', []),
        (PROTEINS_UNIPROT_LMDB, 'proteins', []),
        (SPECIES_NCBI_LMDB, 'species', [rat]),
    ]
    for db_name, entity, data in entities:
        create_entity_lmdb(f'lmdb/{entity}', db_name, data)


@pytest.fixture(scope='function')
def lmdb_setup_test_global_excluded_compound_annotations(app):
    rat = create_ner_type_species(
        id_='10114',
        category=OrganismCategory.EUKARYOTA.value,
        name='rat',
        synonym='rat',
    )

    guanosine = create_ner_type_compound(
        id_='GUANOSINE',
        name='guanosine',
        synonym='guanosine',
    )

    entities = [
        (ANATOMY_MESH_LMDB, 'anatomy', []),
        (CHEMICALS_CHEBI_LMDB, 'chemicals', []),
        (COMPOUNDS_BIOCYC_LMDB, 'compounds', [guanosine]),
        (DISEASES_MESH_LMDB, 'diseases', []),
        (FOODS_MESH_LMDB, 'foods', []),
        (GENES_NCBI_LMDB, 'genes', []),
        (PHENOTYPES_CUSTOM_LMDB, 'phenotypes', []),
        (PROTEINS_UNIPROT_LMDB, 'proteins', []),
        (SPECIES_NCBI_LMDB, 'species', [rat]),
    ]
    for db_name, entity, data in entities:
        create_entity_lmdb(f'lmdb/{entity}', db_name, data)


@pytest.fixture(scope='function')
def lmdb_setup_test_global_excluded_disease_annotations(app):
    rat = create_ner_type_species(
        id_='10114',
        category=OrganismCategory.EUKARYOTA.value,
        name='rat',
        synonym='rat',
    )

    cold_sore = create_ner_type_disease(
        id_='MESH:D006560',
        name='cold sore',
        synonym='cold sore',
    )

    entities = [
        (ANATOMY_MESH_LMDB, 'anatomy', []),
        (CHEMICALS_CHEBI_LMDB, 'chemicals', []),
        (COMPOUNDS_BIOCYC_LMDB, 'compounds', []),
        (DISEASES_MESH_LMDB, 'diseases', [cold_sore]),
        (FOODS_MESH_LMDB, 'foods', []),
        (GENES_NCBI_LMDB, 'genes', []),
        (PHENOTYPES_CUSTOM_LMDB, 'phenotypes', []),
        (PROTEINS_UNIPROT_LMDB, 'proteins', []),
        (SPECIES_NCBI_LMDB, 'species', [rat]),
    ]
    for db_name, entity, data in entities:
        create_entity_lmdb(f'lmdb/{entity}', db_name, data)


@pytest.fixture(scope='function')
def lmdb_setup_test_global_excluded_gene_annotations(app):
    rat = create_ner_type_species(
        id_='10114',
        category=OrganismCategory.EUKARYOTA.value,
        name='rat',
        synonym='rat',
    )

    bola3 = create_ner_type_gene(name='BOLA3', synonym='BOLA3')

    entities = [
        (ANATOMY_MESH_LMDB, 'anatomy', []),
        (CHEMICALS_CHEBI_LMDB, 'chemicals', []),
        (COMPOUNDS_BIOCYC_LMDB, 'compounds', []),
        (DISEASES_MESH_LMDB, 'diseases', []),
        (FOODS_MESH_LMDB, 'foods', []),
        (GENES_NCBI_LMDB, 'genes', [bola3]),
        (PHENOTYPES_CUSTOM_LMDB, 'phenotypes', []),
        (PROTEINS_UNIPROT_LMDB, 'proteins', []),
        (SPECIES_NCBI_LMDB, 'species', [rat]),
    ]
    for db_name, entity, data in entities:
        create_entity_lmdb(f'lmdb/{entity}', db_name, data)


@pytest.fixture(scope='function')
def lmdb_setup_test_global_excluded_phenotype_annotations(app):
    rat = create_ner_type_species(
        id_='10114',
        category=OrganismCategory.EUKARYOTA.value,
        name='rat',
        synonym='rat',
    )

    whey_protein = create_ner_type_phenotype(
        id_='MESH:D000067816',
        name='Whey Proteins',
        synonym='Whey Proteins',
    )

    entities = [
        (ANATOMY_MESH_LMDB, 'anatomy', []),
        (CHEMICALS_CHEBI_LMDB, 'chemicals', []),
        (COMPOUNDS_BIOCYC_LMDB, 'compounds', []),
        (DISEASES_MESH_LMDB, 'diseases', []),
        (FOODS_MESH_LMDB, 'foods', []),
        (GENES_NCBI_LMDB, 'genes', []),
        (PHENOTYPES_CUSTOM_LMDB, 'phenotypes', [whey_protein]),
        (PROTEINS_UNIPROT_LMDB, 'proteins', []),
        (SPECIES_NCBI_LMDB, 'species', [rat]),
    ]
    for db_name, entity, data in entities:
        create_entity_lmdb(f'lmdb/{entity}', db_name, data)


@pytest.fixture(scope='function')
def lmdb_setup_test_global_excluded_protein_annotations(app):
    rat = create_ner_type_species(
        id_='10114',
        category=OrganismCategory.EUKARYOTA.value,
        name='rat',
        synonym='rat',
    )

    wasabi = create_ner_type_protein(
        name='Wasabi receptor toxin',
        synonym='Wasabi receptor toxin',
    )

    entities = [
        (ANATOMY_MESH_LMDB, 'anatomy', []),
        (CHEMICALS_CHEBI_LMDB, 'chemicals', []),
        (COMPOUNDS_BIOCYC_LMDB, 'compounds', []),
        (DISEASES_MESH_LMDB, 'diseases', []),
        (FOODS_MESH_LMDB, 'foods', []),
        (GENES_NCBI_LMDB, 'genes', []),
        (PHENOTYPES_CUSTOM_LMDB, 'phenotypes', []),
        (PROTEINS_UNIPROT_LMDB, 'proteins', [wasabi]),
        (SPECIES_NCBI_LMDB, 'species', [rat]),
    ]
    for db_name, entity, data in entities:
        create_entity_lmdb(f'lmdb/{entity}', db_name, data)


@pytest.fixture(scope='function')
def lmdb_setup_test_global_excluded_species_annotations(app):
    rat = create_ner_type_species(
        id_='10114',
        category=OrganismCategory.EUKARYOTA.value,
        name='rat',
        synonym='rat',
    )

    human = create_ner_type_species(
        id_='9606',
        category=OrganismCategory.EUKARYOTA.value,
        name='human',
        synonym='human',
    )

    entities = [
        (ANATOMY_MESH_LMDB, 'anatomy', []),
        (CHEMICALS_CHEBI_LMDB, 'chemicals', []),
        (COMPOUNDS_BIOCYC_LMDB, 'compounds', []),
        (DISEASES_MESH_LMDB, 'diseases', []),
        (FOODS_MESH_LMDB, 'foods', []),
        (GENES_NCBI_LMDB, 'genes', []),
        (PHENOTYPES_CUSTOM_LMDB, 'phenotypes', []),
        (PROTEINS_UNIPROT_LMDB, 'proteins', []),
        (SPECIES_NCBI_LMDB, 'species', [human, rat]),
    ]
    for db_name, entity, data in entities:
        create_entity_lmdb(f'lmdb/{entity}', db_name, data)


@pytest.fixture(scope='function')
def lmdb_setup_test_global_exclusions_does_not_interfere_with_other_entities(app):
    rat = create_ner_type_species(
        id_='10114',
        category=OrganismCategory.EUKARYOTA.value,
        name='rat',
        synonym='rat',
    )

    adenosine = create_ner_type_chemical(
        id_='CHEBI:16335',
        name='adenosine',
        synonym='adenosine',
    )

    adenosine2 = create_ner_type_compound(
        id_='ADENOSINE',
        name='adenosine',
        synonym='adenosine',
    )

    entities = [
        (ANATOMY_MESH_LMDB, 'anatomy', []),
        (CHEMICALS_CHEBI_LMDB, 'chemicals', [adenosine]),
        (COMPOUNDS_BIOCYC_LMDB, 'compounds', [adenosine2]),
        (DISEASES_MESH_LMDB, 'diseases', []),
        (FOODS_MESH_LMDB, 'foods', []),
        (GENES_NCBI_LMDB, 'genes', []),
        (PHENOTYPES_CUSTOM_LMDB, 'phenotypes', []),
        (PROTEINS_UNIPROT_LMDB, 'proteins', []),
        (SPECIES_NCBI_LMDB, 'species', [rat]),
    ]
    for db_name, entity, data in entities:
        create_entity_lmdb(f'lmdb/{entity}', db_name, data)


@pytest.fixture(scope='function')
def lmdb_setup_test_global_gene_inclusion_annotation(app):
    human = create_ner_type_species(
        id_='9606',
        category=OrganismCategory.EUKARYOTA.value,
        name='human',
        synonym='human',
    )

    entities = [
        (ANATOMY_MESH_LMDB, 'anatomy', []),
        (CHEMICALS_CHEBI_LMDB, 'chemicals', []),
        (COMPOUNDS_BIOCYC_LMDB, 'compounds', []),
        (DISEASES_MESH_LMDB, 'diseases', []),
        (FOODS_MESH_LMDB, 'foods', []),
        (GENES_NCBI_LMDB, 'genes', []),
        (PHENOTYPES_CUSTOM_LMDB, 'phenotypes', []),
        (PROTEINS_UNIPROT_LMDB, 'proteins', []),
        (SPECIES_NCBI_LMDB, 'species', [human]),
    ]
    for db_name, entity, data in entities:
        create_entity_lmdb(f'lmdb/{entity}', db_name, data)


@pytest.fixture(scope='function')
def lmdb_setup_test_no_annotation_for_abbreviation(app):
    pathway = create_ner_type_phenotype(
        id_='MESH:D010427',
        name='Pentose Phosphate Pathway',
        synonym='Pentose Phosphate Pathway',
    )

    hypertension = create_ner_type_disease(
        id_='MESH:D000081029',
        name='Pulmonary Arterial Hypertension',
        synonym='Pulmonary Arterial Hypertension',
    )

    ppp = create_ner_type_gene(name='PPP', synonym='PPP')
    pah = create_ner_type_gene(name='PAH', synonym='PAH')

    entities = [
        (ANATOMY_MESH_LMDB, 'anatomy', []),
        (CHEMICALS_CHEBI_LMDB, 'chemicals', []),
        (COMPOUNDS_BIOCYC_LMDB, 'compounds', []),
        (DISEASES_MESH_LMDB, 'diseases', [hypertension]),
        (FOODS_MESH_LMDB, 'foods', []),
        (GENES_NCBI_LMDB, 'genes', [ppp, pah]),
        (PHENOTYPES_CUSTOM_LMDB, 'phenotypes', [pathway]),
        (PROTEINS_UNIPROT_LMDB, 'proteins', []),
        (SPECIES_NCBI_LMDB, 'species', []),
    ]
    for db_name, entity, data in entities:
        create_entity_lmdb(f'lmdb/{entity}', db_name, data)


@pytest.fixture(scope='function')
def lmdb_setup_test_global_inclusion_normalized_already_in_lmdb(app):
    il8_gene = create_ner_type_gene(name='CXCL8', synonym='IL8')

    il8_protein = create_ner_type_protein(name='CXCL8', synonym='IL8')

    homosapiens = create_ner_type_species(
        id_='9606',
        category=OrganismCategory.EUKARYOTA.value,
        name='Homo Sapiens',
        synonym='Human',
    )

    entities = [
        (ANATOMY_MESH_LMDB, 'anatomy', []),
        (CHEMICALS_CHEBI_LMDB, 'chemicals', []),
        (COMPOUNDS_BIOCYC_LMDB, 'compounds', []),
        (DISEASES_MESH_LMDB, 'diseases', []),
        (FOODS_MESH_LMDB, 'foods', []),
        (GENES_NCBI_LMDB, 'genes', [il8_gene]),
        (PHENOTYPES_CUSTOM_LMDB, 'phenotypes', []),
        (PROTEINS_UNIPROT_LMDB, 'proteins', [il8_protein]),
        (SPECIES_NCBI_LMDB, 'species', [homosapiens]),
    ]
    for db_name, entity, data in entities:
        create_entity_lmdb(f'lmdb/{entity}', db_name, data)


@pytest.fixture(scope='function')
def lmdb_setup_test_can_find_food_entities(app):
    sweetener = create_ner_type_food(
        id_='MESH:D013549',
        name='Sweetening Agents',
        synonym='Artificial Sweeteners',
    )

    bacon = create_ner_type_food(
        id_='MESH:D000080305',
        name='Pork Meat',
        synonym='Bacon',
    )

    entities = [
        (ANATOMY_MESH_LMDB, 'anatomy', []),
        (CHEMICALS_CHEBI_LMDB, 'chemicals', []),
        (COMPOUNDS_BIOCYC_LMDB, 'compounds', []),
        (DISEASES_MESH_LMDB, 'diseases', []),
        (FOODS_MESH_LMDB, 'foods', [bacon, sweetener]),
        (GENES_NCBI_LMDB, 'genes', []),
        (PHENOTYPES_CUSTOM_LMDB, 'phenotypes', []),
        (PROTEINS_UNIPROT_LMDB, 'proteins', []),
        (SPECIES_NCBI_LMDB, 'species', []),
    ]
    for db_name, entity, data in entities:
        create_entity_lmdb(f'lmdb/{entity}', db_name, data)


@pytest.fixture(scope='function')
def lmdb_setup_test_can_find_anatomy_entities(app):
    filamin = create_ner_type_anatomy(
        id_='MESH:D064448',
        name='Filamins',
        synonym='280 kDa Actin Binding Protein',
    )

    claws = create_ner_type_anatomy(
        id_='MESH:D006724',
        name='Hoof and Claw',
        synonym='Claws',
    )

    entities = [
        (ANATOMY_MESH_LMDB, 'anatomy', [claws, filamin]),
        (CHEMICALS_CHEBI_LMDB, 'chemicals', []),
        (COMPOUNDS_BIOCYC_LMDB, 'compounds', []),
        (DISEASES_MESH_LMDB, 'diseases', []),
        (FOODS_MESH_LMDB, 'foods', []),
        (GENES_NCBI_LMDB, 'genes', []),
        (PHENOTYPES_CUSTOM_LMDB, 'phenotypes', []),
        (PROTEINS_UNIPROT_LMDB, 'proteins', []),
        (SPECIES_NCBI_LMDB, 'species', []),
    ]
    for db_name, entity, data in entities:
        create_entity_lmdb(f'lmdb/{entity}', db_name, data)


@pytest.fixture(scope='function')
def lmdb_setup_test_assume_human_gene_after_finding_virus(app):
    ace2 = create_ner_type_gene(name='ACE2', synonym='ACE2',)

    covid_19 = create_ner_type_disease(
        id_='MESH:C000657245',
        name='COVID-19',
        synonym='COVID-19',
    )

    mers_cov = create_ner_type_species(
        id_='1335626',
        category=OrganismCategory.VIRUSES.value,
        name='MERS-CoV',
        synonym='MERS-CoV',
    )

    entities = [
        (ANATOMY_MESH_LMDB, 'anatomy', []),
        (CHEMICALS_CHEBI_LMDB, 'chemicals', []),
        (COMPOUNDS_BIOCYC_LMDB, 'compounds', []),
        (DISEASES_MESH_LMDB, 'diseases', [covid_19]),
        (FOODS_MESH_LMDB, 'foods', []),
        (GENES_NCBI_LMDB, 'genes', [ace2]),
        (PHENOTYPES_CUSTOM_LMDB, 'phenotypes', []),
        (PROTEINS_UNIPROT_LMDB, 'proteins', []),
        (SPECIES_NCBI_LMDB, 'species', [mers_cov]),
    ]
    for db_name, entity, data in entities:
        create_entity_lmdb(f'lmdb/{entity}', db_name, data)


@pytest.fixture(scope='function')
def lmdb_setup_test_gene_organism_escherichia_coli_pdf(app):
    purA = create_ner_type_gene(name='purA', synonym='purA')
    purB = create_ner_type_gene(name='purB', synonym='purB')
    purC = create_ner_type_gene(name='purC', synonym='purC')
    purD = create_ner_type_gene(name='purF', synonym='purF')
    purF = create_ner_type_gene(name='purD', synonym='purD')

    e_coli = create_ner_type_species(
        id_='562',
        category=OrganismCategory.BACTERIA.value,
        name='Escherichia coli',
        synonym='Escherichia coli',
    )

    entities = [
        (ANATOMY_MESH_LMDB, 'anatomy', []),
        (CHEMICALS_CHEBI_LMDB, 'chemicals', []),
        (COMPOUNDS_BIOCYC_LMDB, 'compounds', []),
        (DISEASES_MESH_LMDB, 'diseases', []),
        (FOODS_MESH_LMDB, 'foods', []),
        (GENES_NCBI_LMDB, 'genes', [purA, purB, purC, purD, purF]),
        (PHENOTYPES_CUSTOM_LMDB, 'phenotypes', []),
        (PROTEINS_UNIPROT_LMDB, 'proteins', []),
        (SPECIES_NCBI_LMDB, 'species', [e_coli]),
    ]
    for db_names, entity, data in entities:
        create_entity_lmdb(f'lmdb/{entity}', db_names, data)


@pytest.fixture(scope='function')
def lmdb_setup_test_protein_organism_escherichia_coli_pdf(app):
    ydhc = create_ner_type_protein(name='YdhC', synonym='YdhC')
    ydhb = create_ner_type_protein(name='YdhB', synonym='YdhB')

    e_coli = create_ner_type_species(
        id_='562',
        category=OrganismCategory.BACTERIA.value,
        name='Escherichia coli',
        synonym='Escherichia coli',
    )

    entities = [
        (ANATOMY_MESH_LMDB, 'anatomy', []),
        (CHEMICALS_CHEBI_LMDB, 'chemicals', []),
        (COMPOUNDS_BIOCYC_LMDB, 'compounds', []),
        (DISEASES_MESH_LMDB, 'diseases', []),
        (FOODS_MESH_LMDB, 'foods', []),
        (GENES_NCBI_LMDB, 'genes', []),
        (PHENOTYPES_CUSTOM_LMDB, 'phenotypes', []),
        (PROTEINS_UNIPROT_LMDB, 'proteins', [ydhb, ydhc]),
        (SPECIES_NCBI_LMDB, 'species', [e_coli]),
    ]
    for db_names, entity, data in entities:
        create_entity_lmdb(f'lmdb/{entity}', db_names, data)


@pytest.fixture(scope='function')
def lmdb_setup_test_human_is_prioritized_if_equal_distance_in_gene_organism_matching(app):
    edem3 = create_ner_type_gene(name='Edem3', synonym='Edem3')
    edem3_caps = create_ner_type_gene(name='EDEM3', synonym='EDEM3')

    human = create_ner_type_species(
        id_='9606',
        category=OrganismCategory.EUKARYOTA.value,
        name='human',
        synonym='human'
    )

    rat = create_ner_type_species(
        id_='10116',
        category=OrganismCategory.EUKARYOTA.value,
        name='rat',
        synonym='rat'
    )

    entities = [
        (ANATOMY_MESH_LMDB, 'anatomy', []),
        (CHEMICALS_CHEBI_LMDB, 'chemicals', []),
        (COMPOUNDS_BIOCYC_LMDB, 'compounds', []),
        (DISEASES_MESH_LMDB, 'diseases', []),
        (FOODS_MESH_LMDB, 'foods', []),
        (GENES_NCBI_LMDB, 'genes', [edem3, edem3_caps]),
        (PHENOTYPES_CUSTOM_LMDB, 'phenotypes', []),
        (PROTEINS_UNIPROT_LMDB, 'proteins', []),
        (SPECIES_NCBI_LMDB, 'species', [human, rat]),
    ]
    for db_name, entity, data in entities:
        create_entity_lmdb(f'lmdb/{entity}', db_name, data)


@pytest.fixture(scope='function')
def lmdb_setup_test_gene_id_changes_to_result_from_kg_if_matched_with_organism(app):
    IL7 = create_ner_type_gene(name='IL7', synonym='IL7')
    il7 = create_ner_type_gene(name='il-7', synonym='il-7')

    tetraodon = create_ner_type_species(
        id_='31033',
        category=OrganismCategory.EUKARYOTA.value,
        name='Tetraodon rubripes',
        synonym='Tetraodon rubripes'
    )

    coelacanth = create_ner_type_species(
        id_='7897',
        category=OrganismCategory.EUKARYOTA.value,
        name='coelacanth',
        synonym='coelacanth'
    )

    entities = [
        (ANATOMY_MESH_LMDB, 'anatomy', []),
        (CHEMICALS_CHEBI_LMDB, 'chemicals', []),
        (COMPOUNDS_BIOCYC_LMDB, 'compounds', []),
        (DISEASES_MESH_LMDB, 'diseases', []),
        (FOODS_MESH_LMDB, 'foods', []),
        (GENES_NCBI_LMDB, 'genes', [IL7, il7]),
        (PHENOTYPES_CUSTOM_LMDB, 'phenotypes', []),
        (PROTEINS_UNIPROT_LMDB, 'proteins', []),
        (SPECIES_NCBI_LMDB, 'species', [coelacanth, tetraodon]),
    ]
    for db_name, entity, data in entities:
        create_entity_lmdb(f'lmdb/{entity}', db_name, data)


@pytest.fixture(scope='function')
def vascular_cell_adhesion_lmdb_setup(app):
    vascular = create_ner_type_protein(
        name='Vascular cell adhesion protein 1',
        synonym='Vascular cell adhesion protein 1'
    )

    entities = [
        (ANATOMY_MESH_LMDB, 'anatomy', []),
        (CHEMICALS_CHEBI_LMDB, 'chemicals', []),
        (COMPOUNDS_BIOCYC_LMDB, 'compounds', []),
        (DISEASES_MESH_LMDB, 'diseases', []),
        (FOODS_MESH_LMDB, 'foods', []),
        (GENES_NCBI_LMDB, 'genes', []),
        (PHENOTYPES_CUSTOM_LMDB, 'phenotypes', []),
        (PROTEINS_UNIPROT_LMDB, 'proteins', [vascular]),
        (SPECIES_NCBI_LMDB, 'species', []),
    ]
    for db_name, entity, data in entities:
        create_entity_lmdb(f'lmdb/{entity}', db_name, data)


@pytest.fixture(scope='function')
def lmdb_setup_test_new_gene_organism_matching_algorithm(app):
    ptgs2 = create_ner_type_gene(name='PTGS2', synonym='PTGS2')
    bdnf = create_ner_type_gene(name='BDNF', synonym='BDNF')
    bst2 = create_ner_type_gene(name='BST2', synonym='BST2')

    cat = create_ner_type_species(
        id_='9685',
        category=OrganismCategory.EUKARYOTA.value,
        name='Felis Catus',
        synonym='Felis Catus'
    )

    homo = create_ner_type_species(
        id_='9606',
        category=OrganismCategory.EUKARYOTA.value,
        name='Homo Sapiens',
        synonym='Homo Sapiens'
    )

    human = create_ner_type_species(
        id_='9606',
        category=OrganismCategory.EUKARYOTA.value,
        name='Human',
        synonym='Human'
    )

    entities = [
        (ANATOMY_MESH_LMDB, 'anatomy', []),
        (CHEMICALS_CHEBI_LMDB, 'chemicals', []),
        (COMPOUNDS_BIOCYC_LMDB, 'compounds', []),
        (DISEASES_MESH_LMDB, 'diseases', []),
        (FOODS_MESH_LMDB, 'foods', []),
        (GENES_NCBI_LMDB, 'genes', [ptgs2, bdnf, bst2]),
        (PHENOTYPES_CUSTOM_LMDB, 'phenotypes', []),
        (PROTEINS_UNIPROT_LMDB, 'proteins', []),
        (SPECIES_NCBI_LMDB, 'species', [homo, human, cat]),
    ]
    for db_names, entity, data in entities:
        create_entity_lmdb(f'lmdb/{entity}', db_names, data)


# ################################################################################
# # Start monkeypatch mocks here
# # doc on how to monkeypatch: https://docs.pytest.org/en/latest/monkeypatch.html
# ###############################################################################
@pytest.fixture(scope='function')
def mock_graph_test_local_inclusion_affect_gene_organism_matching(monkeypatch):
    def get_match_result(*args, **kwargs):
        return {'BOLA3': {'BOLA3': {'9606': '388962'}}}

    monkeypatch.setattr(
        AnnotationGraphService,
        'get_gene_to_organism_match_result',
        get_match_result,
    )


@pytest.fixture(scope='function')
def mock_graph_test_genes_vs_proteins(monkeypatch):
    def get_match_result(*args, **kwargs):
        return {
            'hyp27': {'hyp27': {'221103': '2846957'}},
            'SERPINA1': {
                'serpina1': {'9606': '5265'},
                'SERPINA1': {'9606': '5265'}
            }
        }

    monkeypatch.setattr(
        AnnotationGraphService,
        'get_gene_to_organism_match_result',
        get_match_result,
    )


@pytest.fixture(scope='function')
def mock_graph_test_gene_id_changes_to_result_from_kg_if_matched_with_organism(monkeypatch):
    def get_match_result(*args, **kwargs):
        return {
            'il-7': {
                'IL7': {'7897': '102353780'},
                'il-7': {'31033': '99999'}
            }
        }

    monkeypatch.setattr(
        AnnotationGraphService,
        'get_gene_to_organism_match_result',
        get_match_result,
    )


@pytest.fixture(scope='function')
def mock_graph_test_assume_human_gene_after_finding_virus(monkeypatch):
    def get_match_result(*args, **kwargs):
        return {
            'ACE2': {'ACE2': {'9606': '59272'}},
            'Fake_ACE2': {'ACE2': {'9606': '59272'}}
        }

    monkeypatch.setattr(
        AnnotationGraphService,
        'get_gene_to_organism_match_result',
        get_match_result,
    )


@pytest.fixture(scope='function')
def mock_graph_test_global_gene_inclusion_annotation(monkeypatch):
    def get_match_result(*args, **kwargs):
        return {'gene-(12345)': {'ACE2': {'9606': '59272'}}}

    monkeypatch.setattr(
        AnnotationGraphService,
        'get_gene_to_organism_match_result',
        get_match_result,
    )


@pytest.fixture(scope='function')
def mock_graph_global_inclusion_normalized_already_in_lmdb(monkeypatch):
    def get_match_result(*args, **kwargs):
        return {
            'IL8': {'CXCL8': {'9606': '3576'}},
            'IL-8': {'CXCL8': {'9606': '3576'}}
        }

    monkeypatch.setattr(
        AnnotationGraphService,
        'get_gene_to_organism_match_result',
        get_match_result,
    )


@pytest.fixture(scope='function')
def mock_graph_test_human_is_prioritized_if_equal_distance_in_gene_organism_matching(monkeypatch):
    def get_match_result(*args, **kwargs):
        return {
            'EDEM3': {
                'EDEM3': {'9606': '80267'},
                'Edem3': {'10116': '289085'}
            }
        }

    monkeypatch.setattr(
        AnnotationGraphService,
        'get_gene_to_organism_match_result',
        get_match_result,
    )


@pytest.fixture(scope='function')
def mock_graph_test_gene_organism_escherichia_coli_pdf(monkeypatch):
    def get_match_result(*args, **kwargs):
        return {
            'purA': {'purA': {'562': '948695'}},
            'purB': {'purB': {'562': '945695'}},
            'purC': {'purC': {'562': '946957'}},
            'purD': {'purD': {'562': '948504'}},
            'purF': {'purF': {'562': '946794'}},
        }

    monkeypatch.setattr(
        AnnotationGraphService,
        'get_gene_to_organism_match_result',
        get_match_result,
    )


@pytest.fixture(scope='function')
def mock_graph_test_no_annotation_for_abbreviation(monkeypatch):
    def get_match_result(*args, **kwargs):
        return {
            'PPP': {'PPP': {'9606': '80267'}},
            'PAH': {'PAH': {'9606': '289085'}}
        }

    monkeypatch.setattr(
        AnnotationGraphService,
        'get_gene_to_organism_match_result',
        get_match_result,
    )


@pytest.fixture(scope='function')
def mock_graph_test_protein_organism_escherichia_coli_pdf(monkeypatch):
    def get_match_result(*args, **kwargs):
        return {
            'YdhC': {'562': 'P37597'},
            'YdhB': {'562': 'P0ACR2'},
        }

    monkeypatch.setattr(
        AnnotationGraphService,
        'get_proteins_to_organisms',
        get_match_result,
    )


@pytest.fixture(scope='function')
def mock_graph_test_new_gene_organism_matching_algorithm(monkeypatch):
    def get_match_result(*args, **kwargs):
        return {
            'PTGS2': {'PTGS2': {'9606': '5743', '9685': '100126581'}},
            'BDNF': {'BDNF': {'9606': '627', '9685': '493690'}},
            'BST2': {'BST2': {'9606': '684', '9685': '100652388'}}
        }

    monkeypatch.setattr(
        AnnotationGraphService,
        'get_gene_to_organism_match_result',
        get_match_result,
    )


@pytest.fixture(scope='function')
def mock_global_chemical_inclusion_annotation():
    inclusions = [
        {
            'entity_id': 'CHEBI:789456',
            'entity_name': 'fake-chemical-(12345)',
            'synonym': 'fake-chemical-(12345)',
            'data_source': 'CHEBI',
            'hyperlink': ''
        }
    ]

    return {
        normalize_str(inc['synonym']): Inclusion(
            entities=[create_ner_type_chemical(
                inc['entity_id'], inc['entity_name'], inc['synonym'])],
            entity_id_type=inc['data_source'],
            entity_id_hyperlink=inc['hyperlink']
        ) for inc in inclusions
    }


@pytest.fixture(scope='function')
def mock_global_compound_inclusion_annotation():
    inclusions = [
        {
            'entity_id': 'BIOCYC:321357',
            'entity_name': 'compound-(12345)',
            'synonym': 'compound-(12345)',
            'data_source': 'BIOCYC',
            'hyperlink': ''
        }
    ]

    return {
        normalize_str(inc['synonym']): Inclusion(
            entities=[create_ner_type_compound(
                inc['entity_id'], inc['entity_name'], inc['synonym'])],
            entity_id_type=inc['data_source'],
            entity_id_hyperlink=inc.get('hyperlink', '')
        ) for inc in inclusions
    }


@pytest.fixture(scope='function')
def mock_global_gene_inclusion_annotation():
    inclusions = [
        {
            'entity_id': '59272',
            'entity_name': 'gene-(12345)',
            'synonym': 'gene-(12345)',
            'data_source': 'NCBI Gene'
        },
    ]

    return {
        normalize_str(inc['synonym']): Inclusion(
            entities=[create_ner_type_gene(inc['entity_name'], inc['synonym'])],
            entity_id_type=inc['data_source'],
            entity_id_hyperlink=inc.get('hyperlink', '')
        ) for inc in inclusions
    }


@pytest.fixture(scope='function')
def mock_global_inclusion_normalized_already_in_lmdb():
    inclusions = [
        {
            'entity_id': '3576',
            'entity_name': 'CXCL8',
            'synonym': 'IL-8',
            'data_source': 'NCBI Gene'
        }
    ]

    return {
        normalize_str(inc['synonym']): Inclusion(
            entities=[create_ner_type_gene(inc['entity_name'], inc['synonym'])],
            entity_id_type=inc['data_source'],
            entity_id_hyperlink=inc.get('hyperlink', '')
        ) for inc in inclusions
    }


@pytest.fixture(scope='function')
def mock_global_disease_inclusion_annotation():
    inclusions = [
        {
            'entity_id': 'MESH:852753',
            'entity_name': 'disease-(12345)',
            'synonym': 'disease-(12345)',
            'data_source': 'MESH',
        }
    ]

    return {
        normalize_str(inc['synonym']): Inclusion(
            entities=[create_ner_type_disease(
                inc['entity_id'], inc['entity_name'], inc['synonym'])],
            entity_id_type=inc['data_source'],
            entity_id_hyperlink=inc.get('hyperlink', '')
        ) for inc in inclusions
    }


@pytest.fixture(scope='function')
def mock_global_phenomena_inclusion_annotation():
    inclusions = [
        {
            'entity_id': 'MESH:842605',
            'entity_name': 'fake-phenomena',
            'synonym': 'fake-phenomena',
            'data_source': 'MESH',
        }
    ]

    return {
        normalize_str(inc['synonym']): Inclusion(
            entities=[create_ner_type_phenomena(
                inc['entity_id'], inc['entity_name'], inc['synonym'])],
            entity_id_type=inc['data_source'],
            entity_id_hyperlink=inc.get('hyperlink', '')
        ) for inc in inclusions
    }


@pytest.fixture(scope='function')
def mock_global_phenotype_inclusion_annotation():
    inclusions = [
        {
            'entity_id': 'FakePheno',
            'entity_name': 'phenotype-(12345)',
            'synonym': 'phenotype-(12345)',
            'data_source': 'CUSTOM',
        }
    ]

    return {
        normalize_str(inc['synonym']): Inclusion(
            entities=[create_ner_type_phenotype(
                inc['entity_id'], inc['entity_name'], inc['synonym'])],
            entity_id_type=inc['data_source'],
            entity_id_hyperlink=inc.get('hyperlink', '')
        ) for inc in inclusions
    }


@pytest.fixture(scope='function')
def mock_global_protein_inclusion_annotation():
    inclusions = [
        {
            'entity_id': 'Fake_789654',
            'entity_name': 'protein-(12345)',
            'synonym': 'protein-(12345)',
            'data_source': 'UNIPROT',
        }
    ]

    return {
        normalize_str(inc['synonym']): Inclusion(
            entities=[create_ner_type_protein(inc['entity_name'], inc['synonym'])],
            entity_id_type=inc['data_source'],
            entity_id_hyperlink=inc.get('hyperlink', '')
        ) for inc in inclusions
    }


@pytest.fixture(scope='function')
def mock_global_species_inclusion_annotation():
    inclusions = [
        {
            'entity_id': '0088',
            'entity_name': 'species-(12345)',
            'synonym': 'species-(12345)',
            'data_source': 'NCBI Taxonomy',
        }
    ]

    return {
        normalize_str(inc['synonym']): Inclusion(
            entities=[create_ner_type_species(
                inc['entity_id'], inc['entity_name'], inc['synonym'])],
            entity_id_type=inc['data_source'],
            entity_id_hyperlink=inc.get('hyperlink', '')
        ) for inc in inclusions
    }
